import { Router, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Upload path helpers -------------------------------------------------------
const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const computeUploadsRoot = () => {
  const configured = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
  );

  // If the configured directory already points to the certificates folder,
  // mount uploads from its parent to keep URLs consistent at `/uploads/...`.
  return path.basename(configured) === "certificates"
    ? path.dirname(configured)
    : configured;
};

const { uploadsRoot, certificatesRoot } = (() => {
  const root = computeUploadsRoot();
  ensureDirectory(root);
  const certificatesDir = path.join(root, "certificates");
  ensureDirectory(certificatesDir);
  return { uploadsRoot: root, certificatesRoot: certificatesDir };
})();

const CERTIFICATES_URL_PREFIX = "/uploads/certificates";

const getStudentEmailFolder = (email: string) =>
  email.replace(/@/g, "_at_").replace(/\./g, "_");

const buildCertificateUrl = (folderName: string, filename: string) =>
  `${CERTIFICATES_URL_PREFIX}/${folderName}/${filename}`;

const buildCertificatePathCandidates = (fileUrl: string | undefined | null) => {
  if (!fileUrl) {
    return { primary: null as string | null, legacy: null as string | null };
  }

  // Remove domain and leading slashes
  const withoutHost = fileUrl.replace(/^https?:\/\/[^/]+/i, "");
  const trimmed = withoutHost.replace(/^\/+/, "");

  if (!trimmed) {
    return { primary: null, legacy: null };
  }

  const relative = trimmed.startsWith("uploads/")
    ? trimmed.slice("uploads/".length)
    : trimmed;

  const segments = relative
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(
      (segment) => segment.length > 0 && segment !== ".." && segment !== "."
    );

  if (segments.length === 0) {
    return { primary: null, legacy: null };
  }

  const primary = path.join(uploadsRoot, ...segments);
  let legacy: string | null = null;

  if (segments[0] === "certificates" && segments.length > 1) {
    legacy = path.join(uploadsRoot, ...segments.slice(1));
  }

  return { primary, legacy };
};

const resolveFilePath = (fileUrl: string | undefined | null) => {
  const { primary, legacy } = buildCertificatePathCandidates(fileUrl);

  if (!primary) {
    return null;
  }

  if (fs.existsSync(primary)) {
    return primary;
  }

  if (legacy && fs.existsSync(legacy)) {
    try {
      ensureDirectory(path.dirname(primary));
      fs.renameSync(legacy, primary);
      return primary;
    } catch (err) {
      console.error("Failed to migrate legacy certificate file", err);
      return legacy;
    }
  }

  return primary;
};

// Configure multer for file upload
const getUploadDirectoryForStudent = (folderName: string) => {
  const targetDir = path.join(certificatesRoot, folderName);
  ensureDirectory(targetDir);
  return targetDir;
};

const storage = multer.diskStorage({
  destination: async (req: any, _file, cb) => {
    try {
      // Get student email from user
      const userResult = await query("SELECT email FROM users WHERE id = $1", [
        req.user?.id,
      ]);

      if (userResult.rows.length === 0) {
        return cb(new Error("User not found"), "");
      }

      const email = userResult.rows[0].email;
      const folderName = getStudentEmailFolder(email);
      const uploadDir = getUploadDirectoryForStudent(folderName);

      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "cert-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB default
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = (
      process.env.ALLOWED_FILE_TYPES ||
      "image/jpeg,image/png,image/jpg,application/pdf"
    ).split(",");

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Upload certificate (Student)
router.post(
  "/upload",
  authenticate,
  authorize("student"),
  upload.single("certificate"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError("Please upload a file", 400);
      }

      const { title, category, issue_date, description } = req.body;

      // Get student ID and email from user
      const studentResult = await query(
        `SELECT s.id, u.email 
         FROM students s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.user_id = $1`,
        [req.user?.id]
      );

      if (studentResult.rows.length === 0) {
        throw new AppError("Student profile not found", 404);
      }

      const studentId = studentResult.rows[0].id;
      const email = studentResult.rows[0].email;
      const folderName = getStudentEmailFolder(email);
      const fileUrl = buildCertificateUrl(folderName, req.file.filename);

      const result = await query(
        `INSERT INTO certificates (
        student_id, title, category, issue_date, description, 
        file_name, file_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
      RETURNING *`,
        [
          studentId,
          title,
          category || null,
          issue_date || null,
          description || null,
          req.file.originalname,
          fileUrl,
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: "Certificate uploaded successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get student certificates
router.get(
  "/student/:studentId",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Students can only view their own certificates
      if (req.user?.role === "student") {
        const studentCheck = await query(
          "SELECT id FROM students WHERE id = $1 AND user_id = $2",
          [studentId, req.user.id]
        );

        if (studentCheck.rows.length === 0) {
          throw new AppError("Unauthorized", 403);
        }
      }

      const result = await query(
        `SELECT 
        c.*,
        e.name as event_name,
        e.event_date
      FROM certificates c
      LEFT JOIN events e ON c.event_id = e.id
      WHERE c.student_id = $1
      ORDER BY c.uploaded_at DESC`,
        [studentId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all certificates (Admin only)
router.get(
  "/",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, studentId, eventId } = req.query;

      let queryText = `
      SELECT 
        c.*,
        s.name as student_name,
        s.email as student_email,
        s.department,
        e.name as event_name
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      LEFT JOIN events e ON c.event_id = e.id
      WHERE 1=1
    `;
      const params: any[] = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        queryText += ` AND c.status = $${paramCount}`;
        params.push(status);
      }

      if (studentId) {
        paramCount++;
        queryText += ` AND c.student_id = $${paramCount}`;
        params.push(studentId);
      }

      if (eventId) {
        paramCount++;
        queryText += ` AND c.event_id = $${paramCount}`;
        params.push(eventId);
      }

      queryText += " ORDER BY c.uploaded_at DESC";

      const result = await query(queryText, params);

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update certificate status (Admin only)
router.put(
  "/:id/status",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!["Approved", "Pending", "Rejected"].includes(status)) {
        throw new AppError("Invalid status", 400);
      }

      const result = await query(
        `UPDATE certificates SET 
        status = $1,
        remarks = COALESCE($2, remarks)
      WHERE id = $3
      RETURNING *`,
        [status, notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError("Certificate not found", 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: `Certificate ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Generate certificate (Admin only)
router.post(
  "/generate",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        studentId,
        eventId,
        title,
        certificateType,
        issuedBy,
        issuedDate,
      } = req.body;

      if (!studentId || !title) {
        throw new AppError("Student ID and title are required", 400);
      }

      const result = await query(
        `INSERT INTO certificates (
        student_id, event_id, title, certificate_type, 
        issued_by, issued_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Approved')
      RETURNING *`,
        [
          studentId,
          eventId || null,
          title,
          certificateType,
          issuedBy,
          issuedDate || new Date(),
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: "Certificate generated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete certificate (Student can delete own, Admin can delete any)
router.delete(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Get certificate info with owner details
      const certResult = await query(
        `SELECT c.*, s.user_id as owner_user_id, u.email as owner_email
         FROM certificates c
         JOIN students s ON c.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE c.id = $1`,
        [id]
      );

      if (certResult.rows.length === 0) {
        throw new AppError("Certificate not found", 404);
      }

      const certificate = certResult.rows[0];

      // Check if user is owner or admin
      if (userRole !== "admin" && certificate.owner_user_id !== userId) {
        throw new AppError("Not authorized to delete this certificate", 403);
      }

      // Delete from database
      await query("DELETE FROM certificates WHERE id = $1", [id]);

      // Delete file if exists
      const fileUrl = certificate.file_url;
      const filePath = resolveFilePath(fileUrl);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json({
        success: true,
        message: "Certificate deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get certificate by ID (student can get own, admin can get any)
router.get(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const certResult = await query(
        `SELECT c.*, s.user_id as owner_user_id, u.email as owner_email
         FROM certificates c
         JOIN students s ON c.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE c.id = $1`,
        [id]
      );

      if (certResult.rows.length === 0) {
        throw new AppError("Certificate not found", 404);
      }

      const certificate = certResult.rows[0];

      if (userRole !== "admin" && certificate.owner_user_id !== userId) {
        throw new AppError("Not authorized to view this certificate", 403);
      }

      res.json({
        success: true,
        data: certificate,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update certificate metadata or file (student can edit own, admin can edit any)
router.put(
  "/:id",
  authenticate,
  upload.single("certificate"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { title, category, issue_date, description, status, remarks } =
        req.body;

      const certResult = await query(
        `SELECT c.*, s.user_id as owner_user_id, u.email as owner_email
         FROM certificates c
         JOIN students s ON c.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE c.id = $1`,
        [id]
      );

      if (certResult.rows.length === 0) {
        throw new AppError("Certificate not found", 404);
      }

      const existingCert = certResult.rows[0];

      if (userRole !== "admin" && existingCert.owner_user_id !== userId) {
        throw new AppError("Not authorized to update this certificate", 403);
      }

      let fileUrl = existingCert.file_url;
      let originalFileName = existingCert.file_name;

      if (req.file) {
        const emailFolder = getStudentEmailFolder(existingCert.owner_email);
        fileUrl = buildCertificateUrl(emailFolder, req.file.filename);
        originalFileName = req.file.originalname;

        if (existingCert.file_url) {
          const oldFilePath = resolveFilePath(existingCert.file_url);
          if (oldFilePath && fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
      }

      const isAdminUpdatingStatus = userRole === "admin" && status;

      const result = await query(
        `UPDATE certificates SET
          title = COALESCE($1, title),
          category = COALESCE($2, category),
          issue_date = COALESCE($3, issue_date),
          description = COALESCE($4, description),
          file_name = $5,
          file_url = $6,
          status = COALESCE($7, status),
          remarks = COALESCE($8, remarks),
          updated_at = NOW()
        WHERE id = $9
        RETURNING *`,
        [
          title,
          category,
          issue_date,
          description,
          originalFileName,
          fileUrl,
          isAdminUpdatingStatus ? status : null,
          userRole === "admin" ? remarks ?? null : existingCert.remarks,
          id,
        ]
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: "Certificate updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
