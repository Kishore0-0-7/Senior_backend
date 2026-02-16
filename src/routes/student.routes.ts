import { Router, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { uploadProfilePhoto } from "../config/upload";
import { generateProfilePhotoUrl } from "../utils/urlHelper";
import bcrypt from "bcrypt";

const router = Router();

// Get all students (Admin only)
router.get(
  "/",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, college, department, search } = req.query;

      let queryText = "SELECT * FROM v_student_profiles WHERE 1=1";
      const params: any[] = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        queryText += ` AND status = $${paramCount}`;
        params.push(status);
      }

      if (college) {
        paramCount++;
        queryText += ` AND college = $${paramCount}`;
        params.push(college);
      }

      if (department) {
        paramCount++;
        queryText += ` AND department = $${paramCount}`;
        params.push(department);
      }

      if (search) {
        paramCount++;
        queryText += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR registration_number ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      queryText += " ORDER BY name ASC";

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

// Get student metadata (counts)
router.get(
  "/meta",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `
        SELECT 
          COUNT(*)::int AS total,
          COUNT(CASE WHEN status = 'approved' THEN 1 END)::int AS approved,
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END)::int AS rejected
        FROM students
      `,
        []
      );

      const row = result.rows[0] ?? {
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      };

      res.json({
        success: true,
        data: {
          total: Number(row.total) || 0,
          approved: Number(row.approved) || 0,
          pending: Number(row.pending) || 0,
          rejected: Number(row.rejected) || 0,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get student by ID
router.get(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Students can only view their own profile, admins can view any
      if (req.user?.role === "student") {
        const studentCheck = await query(
          "SELECT id FROM students WHERE id = $1 AND user_id = $2",
          [id, req.user.id]
        );

        if (studentCheck.rows.length === 0) {
          throw new AppError("Unauthorized", 403);
        }
      }

      const result = await query(
        "SELECT * FROM v_student_profiles WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError("Student not found", 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// Upload profile photo
router.post(
  "/:id/profile-photo",
  authenticate,
  uploadProfilePhoto.single("profilePhoto"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        throw new AppError("No file uploaded", 400);
      }

      // Students can only update their own profile
      if (req.user?.role === "student") {
        const studentCheck = await query(
          "SELECT id FROM students WHERE id = $1 AND user_id = $2",
          [id, req.user.id]
        );

        if (studentCheck.rows.length === 0) {
          throw new AppError("Unauthorized", 403);
        }
      }

      // Generate the URL for the uploaded file using URL helper
      const photoUrl = generateProfilePhotoUrl(req.file.filename);

      // Update the student's profile photo URL in the database
      const result = await query(
        `UPDATE students SET profile_photo_url = $1 WHERE id = $2 RETURNING *`,
        [photoUrl, id]
      );

      if (result.rows.length === 0) {
        throw new AppError("Student not found", 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: "Profile photo uploaded successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update student
router.put(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        name,
        phone,
        college,
        year,
        department,
        address,
        profilePhotoUrl,
        date_of_birth,
        dateOfBirth: camelDateOfBirth,
        password,
      } = req.body;

      const normalizedDateOfBirth =
        date_of_birth !== undefined
          ? date_of_birth || null
          : camelDateOfBirth !== undefined
          ? camelDateOfBirth || null
          : undefined;

      // Students can only update their own profile
      if (req.user?.role === "student") {
        const studentCheck = await query(
          "SELECT id FROM students WHERE id = $1 AND user_id = $2",
          [id, req.user.id]
        );

        if (studentCheck.rows.length === 0) {
          throw new AppError("Unauthorized", 403);
        }
      }

      const updateFields: string[] = [];
      const values: any[] = [];

      const appendField = (column: string, value: any) => {
        updateFields.push(`${column} = $${values.length + 1}`);
        values.push(value);
      };

      if (name !== undefined) appendField("name", name || null);
      if (phone !== undefined) appendField("phone", phone || null);
      if (college !== undefined) appendField("college", college || null);
      if (year !== undefined) appendField("year", year || null);
      if (department !== undefined)
        appendField("department", department || null);
      if (address !== undefined) appendField("address", address || null);
      if (normalizedDateOfBirth !== undefined)
        appendField("date_of_birth", normalizedDateOfBirth);
      if (profilePhotoUrl !== undefined)
        appendField("profile_photo_url", profilePhotoUrl || null);

      // Handle password update separately (in users table)
      if (password) {
        // Get the user_id associated with this student
        const studentResult = await query(
          "SELECT user_id FROM students WHERE id = $1",
          [id]
        );

        if (studentResult.rows.length === 0) {
          throw new AppError("Student not found", 404);
        }

        const userId = studentResult.rows[0].user_id;

        // Hash the new password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update the password in users table
        await query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [passwordHash, userId]
        );
      }

      if (updateFields.length === 0 && !password) {
        const existing = await query(
          "SELECT * FROM v_student_profiles WHERE id = $1",
          [id]
        );

        if (existing.rows.length === 0) {
          throw new AppError("Student not found", 404);
        }

        res.json({
          success: true,
          data: existing.rows[0],
        });
        return;
      }

      if (updateFields.length > 0) {
        const result = await query(
          `UPDATE students SET ${updateFields.join(", ")}
        WHERE id = $${values.length + 1}
        RETURNING *`,
          [...values, id]
        );

        if (result.rows.length === 0) {
          throw new AppError("Student not found", 404);
        }
      }

      // Fetch updated student data
      const updatedStudent = await query(
        "SELECT * FROM v_student_profiles WHERE id = $1",
        [id]
      );

      res.json({
        success: true,
        data: updatedStudent.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// Approve student (Admin only)
router.put(
  "/:id/approve",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await query(
        `UPDATE students SET status = 'approved' WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError("Student not found", 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: "Student approved successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reject student (Admin only)
router.put(
  "/:id/reject",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await query(
        `UPDATE students SET status = 'rejected' WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError("Student not found", 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: "Student rejected",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete student (Admin only)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Get user_id first
      const studentResult = await query(
        "SELECT user_id FROM students WHERE id = $1",
        [id]
      );

      if (studentResult.rows.length === 0) {
        throw new AppError("Student not found", 404);
      }

      const userId = studentResult.rows[0].user_id;

      // Delete user (will cascade to student due to foreign key)
      await query("DELETE FROM users WHERE id = $1", [userId]);

      res.json({
        success: true,
        message: "Student deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
