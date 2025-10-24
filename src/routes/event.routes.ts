import { Router, Response, NextFunction } from "express";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const getStudentIdForUser = async (userId?: string) => {
  if (!userId) {
    return null;
  }

  const result = await query("SELECT id FROM students WHERE user_id = $1", [
    userId,
  ]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].id;
};

const normalizeEventDate = (rawDate: any): string | null => {
  if (!rawDate) {
    return null;
  }

  // With the pg type parser configured, DATE columns now come as strings "YYYY-MM-DD"
  if (typeof rawDate === "string") {
    const trimmed = rawDate.trim();
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Try to extract date from longer string
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }

  // Fallback for Date objects (shouldn't happen with our config, but just in case)
  if (rawDate instanceof Date) {
    const year = rawDate.getUTCFullYear();
    const month = `${rawDate.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${rawDate.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
};

const normalizeEventTime = (rawTime: any): string | null => {
  if (!rawTime) {
    return null;
  }

  if (rawTime instanceof Date) {
    const hours = `${rawTime.getHours()}`.padStart(2, "0");
    const minutes = `${rawTime.getMinutes()}`.padStart(2, "0");
    const seconds = `${rawTime.getSeconds()}`.padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  if (typeof rawTime === "string") {
    const trimmed = rawTime.trim();
    const match = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const seconds = match[3] ?? "00";
      return `${match[1]}:${match[2]}:${seconds}`;
    }
  }

  return null;
};

const isEventCompleted = (event: any) => {
  const statusValue =
    typeof event.status === "string" ? event.status.trim().toLowerCase() : "";

  if (["completed", "archived"].includes(statusValue)) {
    return true;
  }

  const datePart = normalizeEventDate(event.event_date || event.eventDate);
  if (!datePart) {
    console.warn("[event.register] Unable to determine event date", {
      eventId: event.id,
      eventDate: event.event_date || event.eventDate,
    });
    return false;
  }

  const eventDateStart = new Date(`${datePart}T00:00:00Z`);
  if (Number.isNaN(eventDateStart.getTime())) {
    console.warn("[event.register] Invalid event date", {
      eventId: event.id,
      datePart,
    });
    return false;
  }

  const now = new Date();
  const todayStartUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  if (eventDateStart.getTime() > todayStartUTC.getTime()) {
    console.log("[event.register] Event scheduled for future date", {
      eventId: event.id,
      eventDateUTC: datePart,
      todayUTC: todayStartUTC.toISOString().split("T")[0],
    });
    return false;
  }

  if (eventDateStart.getTime() < todayStartUTC.getTime()) {
    console.log("[event.register] Event date already passed", {
      eventId: event.id,
      eventDateUTC: datePart,
      todayUTC: todayStartUTC.toISOString().split("T")[0],
    });
    return true;
  }

  const timePart = normalizeEventTime(event.event_time || event.eventTime);
  if (!timePart) {
    console.log(
      "[event.register] No event time provided, keeping registration open all day",
      {
        eventId: event.id,
        eventDateUTC: datePart,
      }
    );
    return false;
  }

  const eventDateTime = new Date(`${datePart}T${timePart}Z`);
  if (Number.isNaN(eventDateTime.getTime())) {
    console.warn("[event.register] Unable to parse event time", {
      eventId: event.id,
      eventDate: datePart,
      eventTime: event.event_time || event.eventTime,
    });
    return false;
  }

  const isCompleted = eventDateTime.getTime() <= now.getTime();

  console.log("[event.register] Registration window check", {
    eventId: event.id,
    eventDateTimeUTC: eventDateTime.toISOString(),
    serverNowUTC: now.toISOString(),
    statusValue,
    isCompleted,
  });

  return isCompleted;
};

const markPendingParticipantsAsAbsent = async (event: any) => {
  const { rows: pendingParticipants } = await query(
    `SELECT student_id FROM event_participants WHERE event_id = $1 AND status = 'registered'`,
    [event.id]
  );

  if (pendingParticipants.length === 0) {
    return;
  }

  for (const participant of pendingParticipants) {
    await query(
      `INSERT INTO attendance_logs (student_id, event_id, status, location)
       SELECT $1, $2, 'absent', $3
       WHERE NOT EXISTS (
         SELECT 1 FROM attendance_logs WHERE student_id = $1 AND event_id = $2
       )`,
      [participant.student_id, event.id, event.venue]
    );
  }

  await query(
    `UPDATE event_participants SET status = 'absent'
     WHERE event_id = $1 AND status = 'registered'`,
    [event.id]
  );
};

// Get all events
router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status, category, from_date, to_date } = req.query;

      const params: any[] = [];
      let paramCount = 0;
      let selectFields = "ves.*";
      let joinClause = "";

      const studentId =
        req.user?.role === "student"
          ? await getStudentIdForUser(req.user?.id)
          : null;

      if (studentId) {
        paramCount++;
        selectFields +=
          ", ep.status as registration_status, ep.check_in_time, ep.id as participant_id";
        joinClause = ` LEFT JOIN event_participants ep ON ves.id = ep.event_id AND ep.student_id = $${paramCount}`;
        params.push(studentId);
      }

      let queryText = `SELECT ${selectFields} FROM v_event_statistics ves${joinClause} WHERE 1=1`;

      if (status) {
        paramCount++;
        queryText += ` AND ves.status = $${paramCount}`;
        params.push(status);
      }

      if (category) {
        paramCount++;
        queryText += ` AND ves.category = $${paramCount}`;
        params.push(category);
      }

      if (from_date) {
        paramCount++;
        queryText += ` AND ves.event_date >= $${paramCount}`;
        params.push(from_date);
      }

      if (to_date) {
        paramCount++;
        queryText += ` AND ves.event_date <= $${paramCount}`;
        params.push(to_date);
      }

      queryText += " ORDER BY ves.event_date DESC";

      const result = await query(queryText, params);

      console.log('=== EVENTS API RESPONSE ===');
      console.log('Total events:', result.rows.length);
      if (result.rows.length > 0) {
        result.rows.forEach((event, index) => {
          console.log(`Event ${index + 1}: ${event.name}`);
          console.log(`  event_date: ${event.event_date}`);
          console.log(`  event_time: ${event.event_time}`);
        });
      }
      console.log('===========================');

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Create event (Admin only)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        description,
        eventDate,
        eventTime,
        venue,
        category,
        maxParticipants,
      } = req.body;

      if (!name || !eventDate) {
        throw new AppError("Event name and date are required", 400);
      }

      console.log("[event.create] Received from client:", {
        eventDate,
        eventTime,
        eventDateType: typeof eventDate,
        eventTimeType: typeof eventTime,
      });

      // Generate QR data
      const eventId = uuidv4();
      const qrData = JSON.stringify({
        eventId,
        type: "event_attendance",
        name,
        venue,
        timestamp: new Date().toISOString(),
      });

      // Get admin ID from user ID (if exists)
      let adminId = null;
      const adminResult = await query(
        "SELECT id FROM admins WHERE user_id = $1",
        [req.user?.id]
      );

      if (adminResult.rows.length > 0) {
        adminId = adminResult.rows[0].id;
      }

      const result = await query(
        `INSERT INTO events (
        id, name, description, event_date, event_time, 
        venue, category, qr_data, max_participants, created_by
      ) VALUES ($1, $2, $3, $4::date, $5::time, $6, $7, $8, $9, $10)
      RETURNING *`,
        [
          eventId,
          name,
          description,
          eventDate,
          eventTime,
          venue,
          category,
          qrData,
          maxParticipants,
          adminId,
        ]
      );

      const createdEvent = result.rows[0];
      console.log("[event.create] Stored in database:", {
        id: createdEvent.id,
        event_date: createdEvent.event_date,
        event_time: createdEvent.event_time,
      });

      res.status(201).json({
        success: true,
        data: createdEvent,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get event by ID
router.get(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      let selectFields = "ves.*";
      let joinClause = "";
      const params: any[] = [id];

      if (req.user?.role === "student") {
        const studentId = await getStudentIdForUser(req.user?.id);
        if (studentId) {
          selectFields +=
            ", ep.status as registration_status, ep.check_in_time, ep.id as participant_id";
          joinClause =
            " LEFT JOIN event_participants ep ON ves.id = ep.event_id AND ep.student_id = $2";
          params.push(studentId);
        }
      }

      const result = await query(
        `SELECT ${selectFields} FROM v_event_statistics ves${joinClause} WHERE ves.id = $1`,
        params
      );

      if (result.rows.length === 0) {
        throw new AppError("Event not found", 404);
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

// Register student to event
router.post(
  "/:id/register",
  authenticate,
  authorize("student"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      console.log("[event.register] Incoming request", {
        eventId: id,
        userId: req.user?.id,
        role: req.user?.role,
        bodyStudentId: req.body?.studentId,
      });

      const eventResult = await query("SELECT * FROM events WHERE id = $1", [
        id,
      ]);

      if (eventResult.rows.length === 0) {
        throw new AppError("Event not found", 404);
      }

      const event = eventResult.rows[0];

      const statusValue =
        typeof event.status === "string"
          ? event.status.trim().toLowerCase()
          : "";

      if (["cancelled"].includes(statusValue)) {
        throw new AppError("Event is cancelled", 400);
      }

      if (isEventCompleted(event)) {
        throw new AppError("Event registration has closed", 400);
      }

      let studentId = await getStudentIdForUser(req.user?.id);
      console.log("[event.register] Resolved studentId from token", {
        studentIdFromToken: studentId,
      });

      if (!studentId) {
        const fallbackId =
          typeof req.body?.studentId === "string"
            ? req.body.studentId
            : undefined;

        console.log(
          "[event.register] Token lookup failed, evaluating fallback",
          {
            fallbackId,
          }
        );

        if (fallbackId) {
          const studentCheck = await query(
            "SELECT id FROM students WHERE id = $1",
            [fallbackId]
          );

          if (studentCheck.rows.length > 0) {
            studentId = fallbackId;
            console.log("[event.register] Fallback studentId validated", {
              studentIdFromFallback: studentId,
            });
          }
        }
      }

      if (!studentId) {
        console.warn("[event.register] Unable to resolve studentId", {
          eventId: id,
          userId: req.user?.id,
          bodyStudentId: req.body?.studentId,
        });
        throw new AppError("Student profile not found", 404);
      }

      const existingParticipant = await query(
        "SELECT * FROM event_participants WHERE event_id = $1 AND student_id = $2",
        [id, studentId]
      );

      if (existingParticipant.rows.length > 0) {
        const participant = existingParticipant.rows[0];
        if (["attended", "late"].includes(participant.status)) {
          res.json({
            success: true,
            message: "You have already checked in for this event",
            data: {
              eventId: id,
              registrationStatus: participant.status,
            },
          });
          return;
        }

        if (participant.status === "absent") {
          res.json({
            success: false,
            message: "Event has concluded. Registration is closed.",
          });
          return;
        }

        res.json({
          success: true,
          message: "You are already registered for this event",
          data: {
            eventId: id,
            registrationStatus: participant.status,
          },
        });
        return;
      }

      if (event.max_participants) {
        const { rows } = await query(
          `SELECT COUNT(*)::int as total FROM event_participants
           WHERE event_id = $1 AND status IN ('registered', 'attended', 'late')`,
          [id]
        );

        if (rows[0]?.total >= event.max_participants) {
          throw new AppError("Event has reached maximum capacity", 400);
        }
      }

      const insertResult = await query(
        `INSERT INTO event_participants (event_id, student_id, status)
         VALUES ($1, $2, 'registered')
         RETURNING *`,
        [id, studentId]
      );

      res.json({
        success: true,
        message: "Registered successfully",
        data: {
          eventId: id,
          participantId: insertResult.rows[0].id,
          registrationStatus: insertResult.rows[0].status,
        },
      });
      return;
    } catch (error) {
      return next(error);
    }
  }
);

// Update event (Admin only)
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        eventDate,
        eventTime,
        venue,
        category,
        status,
        maxParticipants,
      } = req.body;

      const result = await query(
        `UPDATE events SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        event_date = COALESCE($3::date, event_date),
        event_time = COALESCE($4::time, event_time),
        venue = COALESCE($5, venue),
        category = COALESCE($6, category),
        status = COALESCE($7, status),
        max_participants = COALESCE($8, max_participants)
      WHERE id = $9
      RETURNING *`,
        [
          name,
          description,
          eventDate,
          eventTime,
          venue,
          category,
          status,
          maxParticipants,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError("Event not found", 404);
      }

      const updatedEvent = result.rows[0];

      const normalizedStatus =
        typeof updatedEvent.status === "string"
          ? updatedEvent.status.trim().toLowerCase()
          : "";

      if (["completed", "archived"].includes(normalizedStatus)) {
        await markPendingParticipantsAsAbsent(updatedEvent);
      }

      res.json({
        success: true,
        data: updatedEvent,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete event (Admin only)
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await query(
        "DELETE FROM events WHERE id = $1 RETURNING *",
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError("Event not found", 404);
      }

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get event QR code
router.get(
  "/:id/qr",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await query("SELECT qr_data FROM events WHERE id = $1", [
        id,
      ]);

      if (result.rows.length === 0) {
        throw new AppError("Event not found", 404);
      }

      const qrData = result.rows[0].qr_data;
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 500,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      res.json({
        success: true,
        data: {
          qrData,
          qrCodeDataURL,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get event participants
router.get(
  "/:id/participants",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT 
        ep.*,
        s.name as student_name,
        s.email as student_email,
        s.department,
        s.college,
        s.registration_number,
        al.proof_photo_url,
        al.latitude,
        al.longitude,
        al.photo_taken_at
      FROM event_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN attendance_logs al ON al.student_id = ep.student_id AND al.event_id = ep.event_id
      WHERE ep.event_id = $1
      ORDER BY ep.check_in_time DESC`,
        [id]
      );

      console.log("=== EVENT PARTICIPANTS QUERY RESULT ===");
      console.log("Event ID:", id);
      console.log("Total participants:", result.rows.length);
      result.rows.forEach((row, idx) => {
        console.log(`Participant ${idx + 1}:`, {
          student_name: row.student_name,
          proof_photo_url: row.proof_photo_url,
          latitude: row.latitude,
          longitude: row.longitude,
          photo_taken_at: row.photo_taken_at,
        });
      });
      console.log("=====================================");

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
