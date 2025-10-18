import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Add admin login (create admin account)
router.post(
  "/add-login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      // Validation
      if (!name || !email || !password) {
        throw new AppError("Name, email, and password are required", 400);
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError("Invalid email format", 400);
      }

      // Password validation (minimum 6 characters)
      if (password.length < 6) {
        throw new AppError("Password must be at least 6 characters long", 400);
      }

      // Check if user already exists
      const existingUser = await query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError(
          "Email already registered. Please use a different email.",
          409
        );
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Begin transaction
      await query("BEGIN");

      try {
        // Create user with admin role
        const userResult = await query(
          `INSERT INTO users (email, password_hash, role) 
           VALUES ($1, $2, 'admin') 
           RETURNING id, email, role`,
          [email, passwordHash]
        );

        const userId = userResult.rows[0].id;

        // Create admin profile
        const adminResult = await query(
          `INSERT INTO admins (user_id, name) 
           VALUES ($1, $2) 
           RETURNING *`,
          [userId, name]
        );

        await query("COMMIT");

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key";
        const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

        // @ts-ignore - jwt.sign type inference issue
        const token = jwt.sign(
          { id: userId, email: email, role: "admin" },
          jwtSecret,
          { expiresIn }
        );

        res.status(201).json({
          success: true,
          message: "Admin account created successfully",
          data: {
            user: {
              id: userId,
              email: email,
              role: "admin",
            },
            admin: {
              id: adminResult.rows[0].id,
              name: adminResult.rows[0].name,
            },
            token,
          },
        });
      } catch (error) {
        await query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
);

// Admin login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      // Find user with admin role
      const result = await query(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1 AND role = 'admin'",
        [email]
      );

      if (result.rows.length === 0) {
        throw new AppError("Invalid credentials", 401);
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        throw new AppError("Invalid credentials", 401);
      }

      // Get admin profile
      const profileResult = await query(
        "SELECT * FROM admins WHERE user_id = $1",
        [user.id]
      );

      const profile = profileResult.rows[0];

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key";
      const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

      // @ts-ignore - jwt.sign type inference issue
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn }
      );

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          profile,
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current admin user
router.get(
  "/current-user",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      if (req.user.role !== "admin") {
        throw new AppError("Access denied. Admin role required.", 403);
      }

      // Get admin profile
      const result = await query("SELECT * FROM admins WHERE user_id = $1", [
        req.user.id,
      ]);

      const profile = result.rows[0];

      res.json({
        success: true,
        data: {
          user: req.user,
          profile,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all students (admin only)
router.get(
  "/students",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Access denied. Admin role required.", 403);
      }

      const result = await query(
        "SELECT * FROM v_student_profiles ORDER BY created_at DESC"
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

// Get all events (admin only)
router.get(
  "/events",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Access denied. Admin role required.", 403);
      }

      const result = await query(
        "SELECT * FROM events ORDER BY event_date DESC"
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

// Get all certificates (admin only)
router.get(
  "/certificates",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        throw new AppError("Access denied. Admin role required.", 403);
      }

      const result = await query(
        "SELECT * FROM certificates ORDER BY issued_at DESC"
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

export default router;
