import { Router, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const GRACE_PERIOD_MINUTES = 15;

const parseEventDateTime = (event: any) => {
  const rawDate = event.event_date || event.eventDate;
  if (!rawDate) {
    return null;
  }

  let datePart: string | null = null;

  if (rawDate instanceof Date) {
    const year = rawDate.getFullYear();
    const month = `${rawDate.getMonth() + 1}`.padStart(2, "0");
    const day = `${rawDate.getDate()}`.padStart(2, "0");
    datePart = `${year}-${month}-${day}`;
  } else if (typeof rawDate === "string") {
    const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    datePart = match ? match[1] : rawDate;
  }

  if (!datePart) {
    return null;
  }

  const rawTime = event.event_time || event.eventTime;
  let timePart = "00:00:00";

  if (typeof rawTime === "string" && rawTime.trim().length >= 4) {
    const trimmed = rawTime.trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      timePart = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    }
  }

  const combined = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(combined.getTime()) ? null : combined;
};

const isEventCompleted = (event: any) => {
  const statusValue =
    typeof event.status === "string" ? event.status.trim().toLowerCase() : "";

  if (["completed", "archived"].includes(statusValue)) {
    return true;
  }

  const eventDateTime = parseEventDateTime(event);
  if (!eventDateTime) {
    return false;
  }

  return eventDateTime.getTime() < Date.now();
};

const router = Router();

// Check-in to event (Student scans QR)
router.post(
  "/checkin",
  authenticate,
  authorize("student"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { qrData, location, deviceInfo } = req.body;

      if (!qrData) {
        throw new AppError("QR data is required", 400);
      }

      // Parse QR data
      let eventData;
      try {
        eventData = JSON.parse(qrData);
      } catch (e) {
        throw new AppError("Invalid QR code format", 400);
      }

      const { eventId } = eventData;

      if (!eventId) {
        throw new AppError("Invalid event QR code", 400);
      }

      // Check if event exists
      const eventResult = await query("SELECT * FROM events WHERE id = $1", [
        eventId,
      ]);

      if (eventResult.rows.length === 0) {
        throw new AppError("Event not found", 404);
      }

      const event = eventResult.rows[0];

      // Check event status
      const statusValue =
        typeof event.status === "string"
          ? event.status.trim().toLowerCase()
          : null;

      if (statusValue && ["cancelled"].includes(statusValue)) {
        throw new AppError("Event is not open for attendance", 400);
      }

      const now = new Date();
      const eventDateTime = parseEventDateTime(event);
      let attendanceStatus: "present" | "late" = "present";
      let participantStatus: "attended" | "late" = "attended";

      if (eventDateTime) {
        const graceWindowEnd = new Date(
          eventDateTime.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000
        );

        if (now < eventDateTime) {
          throw new AppError("Event has not started yet", 400);
        }

        if (now > graceWindowEnd) {
          attendanceStatus = "late";
          participantStatus = "late";
        }
      }

      if (isEventCompleted(event)) {
        throw new AppError("Event is already completed", 400);
      }

      // Get student ID from user
      const studentResult = await query(
        "SELECT id FROM students WHERE user_id = $1",
        [req.user?.id]
      );

      if (studentResult.rows.length === 0) {
        throw new AppError("Student profile not found", 404);
      }

      const studentId = studentResult.rows[0].id;

      // Check if already checked in
      const existingParticipant = await query(
        "SELECT * FROM event_participants WHERE event_id = $1 AND student_id = $2",
        [eventId, studentId]
      );

      const attendanceLocation = location || event.venue || null;

      if (existingParticipant.rows.length > 0) {
        // Update status based on check-in timing
        await query(
          `UPDATE event_participants SET 
          status = $3, 
          check_in_time = CURRENT_TIMESTAMP 
        WHERE event_id = $1 AND student_id = $2`,
          [eventId, studentId, participantStatus]
        );
      } else {
        // Create new participant
        await query(
          `INSERT INTO event_participants (event_id, student_id, status, check_in_time)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [eventId, studentId, participantStatus]
        );
      }

      // Log attendance and get the inserted/updated record
      const existingAttendanceLog = await query(
        `SELECT id FROM attendance_logs WHERE student_id = $1 AND event_id = $2`,
        [studentId, eventId]
      );

      let attendanceResult;

      if (existingAttendanceLog.rows.length > 0) {
        attendanceResult = await query(
          `UPDATE attendance_logs
           SET status = $2,
               location = COALESCE($3, location),
               scanned_qr_data = COALESCE($4, scanned_qr_data),
               device_info = COALESCE($5, device_info),
               timestamp = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [
            existingAttendanceLog.rows[0].id,
            attendanceStatus,
            attendanceLocation,
            qrData,
            deviceInfo ? JSON.stringify(deviceInfo) : null,
          ]
        );
      } else {
        attendanceResult = await query(
          `INSERT INTO attendance_logs (student_id, event_id, status, location, scanned_qr_data, device_info)
        VALUES ($1, $2, $6, $3, $4, $5)
        RETURNING *`,
          [
            studentId,
            eventId,
            attendanceLocation,
            qrData,
            deviceInfo ? JSON.stringify(deviceInfo) : null,
            attendanceStatus,
          ]
        );
      }

      const attendanceLog = attendanceResult.rows[0];

      res.json({
        success: true,
        message: "Attendance marked successfully",
        data: {
          id: attendanceLog.id,
          studentId: attendanceLog.student_id,
          eventId: attendanceLog.event_id,
          eventName: event.name,
          eventVenue: event.venue,
          location: attendanceLog.location || event.venue,
          checkInTime: attendanceLog.timestamp || new Date().toISOString(),
          status: attendanceLog.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get student attendance history
router.get(
  "/student/:studentId",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Students can only view their own attendance
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
        al.*,
        e.name as event_name,
        e.event_date,
        e.venue
      FROM attendance_logs al
      LEFT JOIN events e ON al.event_id = e.id
      WHERE al.student_id = $1
      ORDER BY al.timestamp DESC`,
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

// Get event attendance (Admin only)
router.get(
  "/event/:eventId",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;

      const result = await query(
        `SELECT 
        ep.*,
        s.name as student_name,
        s.email as student_email,
        s.department,
        s.college,
        s.registration_number
      FROM event_participants ep
      JOIN students s ON ep.student_id = s.id
      WHERE ep.event_id = $1
      ORDER BY ep.check_in_time DESC`,
        [eventId]
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

// Update participant status (Admin only)
router.put(
  "/participant/:participantId",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { participantId } = req.params;
      const { status, notes } = req.body;

      const result = await query(
        `UPDATE event_participants SET 
        status = COALESCE($1, status),
        notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *`,
        [status, notes, participantId]
      );

      if (result.rows.length === 0) {
        throw new AppError("Participant not found", 404);
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

export default router;
