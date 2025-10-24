import { Router, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { uploadOnDutyDocument, uploadOnDutySelfie } from "../config/upload";
import path from "path";
import fs from "fs";

const router = Router();

/**
 * @route   POST /api/onduty/request
 * @desc    Create a new on-duty request (Student only)
 * @access  Private (Student)
 */
router.post(
  "/request",
  authenticate,
  authorize("student"),
  uploadOnDutyDocument.single("document"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;
      const { collegeName, startDate, startTime, endDate, endTime, reason } =
        req.body;

      // Validate required fields
      if (
        !collegeName ||
        !startDate ||
        !startTime ||
        !endDate ||
        !endTime ||
        !reason
      ) {
        throw new AppError("All fields are required", 400);
      }

      // Validate student exists in students table, create if missing
      let studentCheck = await query(
        `SELECT id, name, status FROM students WHERE user_id = $1`,
        [studentId]
      );

      // Auto-create student record if missing
      if (studentCheck.rows.length === 0) {
        const userInfo = await query(
          `SELECT email FROM users WHERE id = $1`,
          [studentId]
        );

        if (userInfo.rows.length === 0) {
          throw new AppError("User not found", 404);
        }

        const email = userInfo.rows[0].email;
        const regNumber = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random number

        // Create student record
        await query(
          `INSERT INTO students (user_id, name, email, phone, college, department, year, registration_number, status)
           VALUES ($1, $2, $3, '', 'Default', 'CS', '1st', $4, 'approved')`,
          [studentId, email.split('@')[0], email, regNumber]
        );

        // Re-fetch student record
        studentCheck = await query(
          `SELECT id, name, status FROM students WHERE user_id = $1`,
          [studentId]
        );
      }

      const student = studentCheck.rows[0];

      // Check if student is approved
      if (student.status !== "approved") {
        throw new AppError(
          `Your student profile is ${student.status}. Only approved students can submit on-duty requests.`,
          403
        );
      }

      // Validate dates
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      const now = new Date();

      // Check if dates are in the past
      if (start < now) {
        throw new AppError("Start date/time cannot be in the past", 400);
      }

      if (end <= start) {
        throw new AppError("End date/time must be after start date/time", 400);
      }

      // Check if request is too far in the future (e.g., more than 1 year)
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      if (start > oneYearFromNow) {
        throw new AppError(
          "On-duty requests cannot be more than one year in advance",
          400
        );
      }

      // Get document URL if file was uploaded
      let documentUrl = null;
      if (req.file) {
        documentUrl = `/uploads/onduty-documents/${req.file.filename}`;
      }

      // Insert on-duty request (use student.id from students table, not user_id)
      const result = await query(
        `INSERT INTO on_duty_requests 
        (student_id, college_name, start_date, start_time, end_date, end_time, reason, document_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING *`,
        [
          student.id, // Use student ID from students table
          collegeName,
          startDate,
          startTime,
          endDate,
          endTime,
          reason,
          documentUrl,
        ]
      );

      res.status(201).json({
        success: true,
        message: "On-duty request submitted successfully",
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/onduty/my-requests
 * @desc    Get all on-duty requests for current student
 * @access  Private (Student)
 */
router.get(
  "/my-requests",
  authenticate,
  authorize("student"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;

      const result = await query(
        `SELECT 
          odr.*,
          a.name as approved_by_name
        FROM on_duty_requests odr
        LEFT JOIN admins a ON odr.approved_by = a.id
        WHERE odr.student_id = $1
        ORDER BY odr.created_at DESC`,
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

/**
 * @route   GET /api/onduty/approved
 * @desc    Get approved on-duty requests for current student
 * @access  Private (Student)
 */
router.get(
  "/approved",
  authenticate,
  authorize("student"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;
      const today = new Date().toISOString().split("T")[0];

      const result = await query(
        `SELECT 
          odr.*,
          a.name as approved_by_name
        FROM on_duty_requests odr
        LEFT JOIN admins a ON odr.approved_by = a.id
        WHERE odr.student_id = $1 
          AND odr.status = 'approved'
          AND odr.start_date <= $2
          AND odr.end_date >= $2
        ORDER BY odr.start_date DESC`,
        [studentId, today]
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

/**
 * @route   POST /api/onduty/attendance
 * @desc    Mark attendance for an approved on-duty request
 * @access  Private (Student)
 */
router.post(
  "/attendance",
  authenticate,
  authorize("student"),
  uploadOnDutySelfie.single("selfie"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;
      const { onDutyRequestId, latitude, longitude, address, qrData } =
        req.body;

      // Validate required fields
      if (!onDutyRequestId || !latitude || !longitude) {
        throw new AppError(
          "On-duty request ID, latitude, and longitude are required",
          400
        );
      }

      // Verify the on-duty request exists and is approved
      const odRequest = await query(
        `SELECT * FROM on_duty_requests 
        WHERE id = $1 AND student_id = $2 AND status = 'approved'`,
        [onDutyRequestId, studentId]
      );

      if (odRequest.rows.length === 0) {
        throw new AppError("On-duty request not found or not approved", 404);
      }

      // Check if the request is valid for today
      const today = new Date().toISOString().split("T")[0];
      const request = odRequest.rows[0];

      if (today < request.start_date || today > request.end_date) {
        throw new AppError("On-duty request is not valid for today", 400);
      }

      // Check if attendance already marked for today
      const existingAttendance = await query(
        `SELECT * FROM on_duty_attendance 
        WHERE on_duty_request_id = $1 
          AND student_id = $2 
          AND DATE(check_in_time) = $3`,
        [onDutyRequestId, studentId, today]
      );

      if (existingAttendance.rows.length > 0) {
        throw new AppError(
          "Attendance already marked for this on-duty request today",
          400
        );
      }

      // Get selfie URL if file was uploaded
      let selfieUrl = null;
      if (req.file) {
        selfieUrl = `/uploads/onduty-selfies/${req.file.filename}`;
      }

      // Insert attendance record
      const result = await query(
        `INSERT INTO on_duty_attendance 
        (on_duty_request_id, student_id, latitude, longitude, address, selfie_photo_url, qr_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          onDutyRequestId,
          studentId,
          latitude,
          longitude,
          address || null,
          selfieUrl,
          qrData || null,
        ]
      );

      res.status(201).json({
        success: true,
        message: "On-duty attendance marked successfully",
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/onduty/attendance-history
 * @desc    Get on-duty attendance history for current student
 * @access  Private (Student)
 */
router.get(
  "/attendance-history",
  authenticate,
  authorize("student"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user?.id;

      const result = await query(
        `SELECT 
          oda.*,
          odr.college_name,
          odr.start_date,
          odr.end_date
        FROM on_duty_attendance oda
        JOIN on_duty_requests odr ON oda.on_duty_request_id = odr.id
        WHERE oda.student_id = $1
        ORDER BY oda.check_in_time DESC`,
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

/**
 * @route   GET /api/onduty/admin/requests
 * @desc    Get all on-duty requests (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/admin/requests",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, search, startDate, endDate } = req.query;

      let queryText = `
        SELECT 
          odr.*,
          s.name as student_name,
          s.email as student_email,
          s.registration_number,
          s.department,
          s.college,
          a.name as approved_by_name
        FROM on_duty_requests odr
        JOIN students s ON odr.student_id = s.id
        LEFT JOIN admins a ON odr.approved_by = a.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (status) {
        paramCount++;
        queryText += ` AND odr.status = $${paramCount}`;
        params.push(status);
      }

      if (search) {
        paramCount++;
        queryText += ` AND (
          s.name ILIKE $${paramCount} OR 
          s.email ILIKE $${paramCount} OR 
          s.registration_number ILIKE $${paramCount} OR
          odr.college_name ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
      }

      if (startDate) {
        paramCount++;
        queryText += ` AND odr.start_date >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        queryText += ` AND odr.end_date <= $${paramCount}`;
        params.push(endDate);
      }

      queryText += " ORDER BY odr.created_at DESC";

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

/**
 * @route   PUT /api/onduty/admin/requests/:id
 * @desc    Approve or reject an on-duty request (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/admin/requests/:id",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, rejectionReason } = req.body;
      const adminId = req.user?.id;

      // Validate status
      if (!["approved", "rejected"].includes(status)) {
        throw new AppError(
          'Status must be either "approved" or "rejected"',
          400
        );
      }

      // If rejecting, reason is required
      if (status === "rejected" && !rejectionReason) {
        throw new AppError("Rejection reason is required", 400);
      }

      // Check if request exists
      const existingRequest = await query(
        "SELECT * FROM on_duty_requests WHERE id = $1",
        [id]
      );

      if (existingRequest.rows.length === 0) {
        throw new AppError("On-duty request not found", 404);
      }

      // Update request status
      const result = await query(
        `UPDATE on_duty_requests 
        SET status = $1, 
            approved_by = $2, 
            rejection_reason = $3, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`,
        [status, adminId, rejectionReason || null, id]
      );

      res.json({
        success: true,
        message: `On-duty request ${status} successfully`,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/onduty/admin/attendance
 * @desc    Get all on-duty attendance records (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/admin/attendance",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId, startDate, endDate } = req.query;

      let queryText = `
        SELECT 
          oda.*,
          s.name as student_name,
          s.email as student_email,
          s.registration_number,
          odr.college_name,
          odr.start_date as od_start_date,
          odr.end_date as od_end_date
        FROM on_duty_attendance oda
        JOIN students s ON oda.student_id = s.id
        JOIN on_duty_requests odr ON oda.on_duty_request_id = odr.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (studentId) {
        paramCount++;
        queryText += ` AND oda.student_id = $${paramCount}`;
        params.push(studentId);
      }

      if (startDate) {
        paramCount++;
        queryText += ` AND DATE(oda.check_in_time) >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        queryText += ` AND DATE(oda.check_in_time) <= $${paramCount}`;
        params.push(endDate);
      }

      queryText += " ORDER BY oda.check_in_time DESC";

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

/**
 * @route   DELETE /api/onduty/request/:id
 * @desc    Delete an on-duty request (Student only, only if pending)
 * @access  Private (Student)
 */
router.delete(
  "/request/:id",
  authenticate,
  authorize("student"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const studentId = req.user?.id;

      // Check if request exists and belongs to student
      const existingRequest = await query(
        "SELECT * FROM on_duty_requests WHERE id = $1 AND student_id = $2",
        [id, studentId]
      );

      if (existingRequest.rows.length === 0) {
        throw new AppError("On-duty request not found", 404);
      }

      const request = existingRequest.rows[0];

      // Only allow deletion of pending requests
      if (request.status !== "pending") {
        throw new AppError(
          "Cannot delete an on-duty request that has been processed",
          400
        );
      }

      // Delete document file if exists
      if (request.document_url) {
        const filePath = path.join(__dirname, "../../", request.document_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Delete the request
      await query("DELETE FROM on_duty_requests WHERE id = $1", [id]);

      res.json({
        success: true,
        message: "On-duty request deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
