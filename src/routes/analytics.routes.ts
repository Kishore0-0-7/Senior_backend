import { Router, Response, NextFunction } from "express";
import { query } from "../config/database";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();

// Get event statistics
router.get(
  "/events",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { from_date, to_date, department, college } = req.query;

      let queryText = `
      SELECT 
        e.*,
        COUNT(DISTINCT ep.student_id) as total_participants,
        COUNT(DISTINCT CASE WHEN ep.status = 'attended' THEN ep.student_id END) as attended_count,
        COUNT(DISTINCT CASE WHEN ep.status = 'registered' THEN ep.student_id END) as registered_count,
        COUNT(DISTINCT CASE WHEN ep.status = 'absent' THEN ep.student_id END) as absent_count,
        AVG(CASE WHEN ep.status = 'attended' THEN 1 ELSE 0 END) * 100 as attendance_rate
      FROM events e
      LEFT JOIN event_participants ep ON e.id = ep.event_id
      LEFT JOIN students s ON ep.student_id = s.id
      WHERE 1=1
    `;
      const params: any[] = [];
      let paramCount = 0;

      if (from_date) {
        paramCount++;
        queryText += ` AND e.event_date >= $${paramCount}`;
        params.push(from_date);
      }

      if (to_date) {
        paramCount++;
        queryText += ` AND e.event_date <= $${paramCount}`;
        params.push(to_date);
      }

      if (department) {
        paramCount++;
        queryText += ` AND s.department = $${paramCount}`;
        params.push(department);
      }

      if (college) {
        paramCount++;
        queryText += ` AND s.college = $${paramCount}`;
        params.push(college);
      }

      queryText += " GROUP BY e.id ORDER BY e.event_date DESC";

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

// Get student statistics
router.get(
  "/students",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await query(`
      SELECT 
        COUNT(*) as total_students,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_students,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_students,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_students,
        COUNT(DISTINCT college) as total_colleges,
        COUNT(DISTINCT department) as total_departments
      FROM students
    `);

      const departmentStats = await query(`
      SELECT 
        department,
        COUNT(*) as student_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
      FROM students
      WHERE department IS NOT NULL
      GROUP BY department
      ORDER BY student_count DESC
    `);

      const collegeStats = await query(`
      SELECT 
        college,
        COUNT(*) as student_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
      FROM students
      WHERE college IS NOT NULL
      GROUP BY college
      ORDER BY student_count DESC
    `);

      res.json({
        success: true,
        data: {
          overview: result.rows[0],
          byDepartment: departmentStats.rows,
          byCollege: collegeStats.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get attendance analytics
router.get(
  "/attendance",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { from_date, to_date } = req.query;

      let queryText = `
      SELECT 
        DATE(al.timestamp) as date,
        COUNT(DISTINCT al.student_id) as unique_students,
        COUNT(*) as total_checkins
      FROM attendance_logs al
      WHERE 1=1
    `;
      const params: any[] = [];
      let paramCount = 0;

      if (from_date) {
        paramCount++;
        queryText += ` AND al.timestamp >= $${paramCount}`;
        params.push(from_date);
      }

      if (to_date) {
        paramCount++;
        queryText += ` AND al.timestamp <= $${paramCount}`;
        params.push(to_date);
      }

      queryText += " GROUP BY DATE(al.timestamp) ORDER BY date DESC";

      const dailyStats = await query(queryText, params);

      const topStudents = await query(`
      SELECT 
        s.id,
        s.name,
        s.department,
        s.college,
        COUNT(DISTINCT ep.event_id) as events_attended
      FROM students s
      JOIN event_participants ep ON s.id = ep.student_id
      WHERE ep.status = 'attended'
      GROUP BY s.id
      ORDER BY events_attended DESC
      LIMIT 10
    `);

      res.json({
        success: true,
        data: {
          dailyStats: dailyStats.rows,
          topStudents: topStudents.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get certificate analytics
router.get(
  "/certificates",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await query(`
      SELECT 
        COUNT(*) as total_certificates,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved_certificates,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_certificates,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected_certificates
      FROM certificates
    `);

      const byEvent = await query(`
      SELECT 
        e.name as event_name,
        e.event_date,
        COUNT(c.id) as certificate_count,
        COUNT(CASE WHEN c.status = 'Approved' THEN 1 END) as approved_count
      FROM events e
      LEFT JOIN certificates c ON e.id = c.event_id
      GROUP BY e.id
      ORDER BY certificate_count DESC
      LIMIT 10
    `);

      res.json({
        success: true,
        data: {
          overview: result.rows[0],
          byEvent: byEvent.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get dashboard overview
router.get(
  "/dashboard",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const students = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM students
    `);

      const events = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
      FROM events
    `);

      const certificates = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending
      FROM certificates
    `);

      const recentActivity = await query(`
      SELECT 
        al.timestamp,
        s.name as student_name,
        e.name as event_name
      FROM attendance_logs al
      JOIN students s ON al.student_id = s.id
      LEFT JOIN events e ON al.event_id = e.id
      ORDER BY al.timestamp DESC
      LIMIT 10
    `);

      res.json({
        success: true,
        data: {
          students: students.rows[0],
          events: events.rows[0],
          certificates: certificates.rows[0],
          recentActivity: recentActivity.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
