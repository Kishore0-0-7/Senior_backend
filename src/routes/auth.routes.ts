import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// Register new student
router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        full_name, // From mobile app
        name, // Alternative field name
        email,
        password,
        phone_number,
        phone, // Alternative field name
        college,
        year,
        department,
        roll_number,
        registration_number, // Alternative field name
        address,
        date_of_birth,
      } = req.body;

      // Use whichever field name is provided
      const studentName = full_name || name;
      const studentPhone = phone_number || phone;
      const studentRollNumber = roll_number || registration_number;

      // Validation
      if (!studentName || !email || !password) {
        throw new AppError("Name, email, and password are required", 400);
      }

      if (!studentRollNumber) {
        throw new AppError("Roll number/registration number is required", 400);
      }

      // Check if user already exists
      const existingUser = await query(
        "SELECT id FROM users WHERE email = $1",
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError("Email already registered", 409);
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Begin transaction
      await query("BEGIN");

      try {
        // Create user
        const userResult = await query(
          `INSERT INTO users (email, password_hash, role) 
         VALUES ($1, $2, 'student') 
         RETURNING id, email, role`,
          [email, passwordHash]
        );

        const userId = userResult.rows[0].id;

        // Create student profile
        const studentResult = await query(
          `INSERT INTO students (
          user_id, name, email, phone, college, year, 
          department, registration_number, address, date_of_birth, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
        RETURNING *`,
          [
            userId,
            studentName,
            email,
            studentPhone || null,
            college || null,
            year || null,
            department || null,
            studentRollNumber,
            address || null,
            date_of_birth || null,
          ]
        );

        await query("COMMIT");

        const student = studentResult.rows[0];

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key";
        const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
        // @ts-ignore - jwt.sign type inference issue
        const token = jwt.sign(
          { id: userId, email, role: "student" },
          jwtSecret,
          { expiresIn }
        );

        res.status(201).json({
          success: true,
          data: {
            user: {
              id: userId,
              email,
              role: "student",
            },
            student: {
              id: student.id,
              student_id: student.id,
              name: student.name,
              full_name: student.name, // For mobile app compatibility
              email: student.email,
              status: student.status,
              department: student.department,
              year: student.year,
              roll_number: student.registration_number,
              registration_number: student.registration_number,
              phone: student.phone,
              phone_number: student.phone,
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

// Login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      // Get user
      const userResult = await query(
        "SELECT * FROM users WHERE email = $1 AND is_active = true",
        [email]
      );

      if (userResult.rows.length === 0) {
        throw new AppError("Invalid email or password", 401);
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!isValidPassword) {
        throw new AppError("Invalid email or password", 401);
      }

      // Update last login
      await query(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
        [user.id]
      );

      // Get profile based on role
      let profile = null;
      if (user.role === "student") {
        const studentResult = await query(
          "SELECT * FROM students WHERE user_id = $1",
          [user.id]
        );
        profile = studentResult.rows[0];
      } else if (user.role === "admin") {
        const adminResult = await query(
          "SELECT * FROM admins WHERE user_id = $1",
          [user.id]
        );
        profile = adminResult.rows[0];
      }

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

// Get current user
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("User not authenticated", 401);
      }

      // Get profile based on role
      let profile = null;
      if (req.user.role === "student") {
        const result = await query(
          "SELECT * FROM v_student_profiles WHERE user_id = $1",
          [req.user.id]
        );
        profile = result.rows[0];
      } else if (req.user.role === "admin") {
        const result = await query("SELECT * FROM admins WHERE user_id = $1", [
          req.user.id,
        ]);
        profile = result.rows[0];
      }

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

// Logout (optional - mainly for client side)
router.post("/logout", authenticate, (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// Create admin (Protected by environment flag)
router.post(
  "/create-admin",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if admin creation is allowed via environment variable
      const allowAdminCreation = process.env.ALLOW_ADMIN_CREATION === "true";

      if (!allowAdminCreation) {
        throw new AppError(
          "Admin creation is currently disabled. Enable ALLOW_ADMIN_CREATION in environment variables.",
          403
        );
      }

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
          `INSERT INTO admins (user_id, name, email) 
           VALUES ($1, $2, $3) 
           RETURNING *`,
          [userId, name, email]
        );

        await query("COMMIT");

        res.status(201).json({
          success: true,
          message: "Admin account created successfully",
          data: {
            admin: {
              id: adminResult.rows[0].id,
              name: adminResult.rows[0].name,
              email: adminResult.rows[0].email,
            },
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

export default router;
