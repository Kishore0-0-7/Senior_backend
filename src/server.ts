import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { query } from "./config/database";

// Import routes
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import studentRoutes from "./routes/student.routes";
import eventRoutes from "./routes/event.routes";
import attendanceRoutes from "./routes/attendance.routes";
import certificateRoutes from "./routes/certificate.routes";
import analyticsRoutes from "./routes/analytics.routes";
import onDutyRoutes from "./routes/onduty.routes";

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || "/api";

const computeUploadsRoot = () => {
  const configured = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
  );

  return path.basename(configured) === "certificates"
    ? path.dirname(configured)
    : configured;
};

const uploadsRoot = computeUploadsRoot();
const certificatesRoot = path.join(uploadsRoot, "certificates");
const attendancePhotosRoot = path.join(uploadsRoot, "attendance-photos");
const onDutyDocumentsRoot = path.join(uploadsRoot, "onduty-documents");
const onDutySelfiesRoot = path.join(uploadsRoot, "onduty-selfies");

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDirectory(uploadsRoot);
ensureDirectory(certificatesRoot);
ensureDirectory(attendancePhotosRoot);
ensureDirectory(onDutyDocumentsRoot);
ensureDirectory(onDutySelfiesRoot);

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(compression()); // Compress responses
app.use(morgan("dev")); // Request logging
const BODY_LIMIT = process.env.API_BODY_LIMIT || "100mb";

app.use(express.json({ limit: BODY_LIMIT })); // Parse JSON bodies with higher limit for photo uploads
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT })); // Parse URL-encoded bodies

// Static files for uploads with legacy path migration
app.get(
  "/uploads/certificates/:folder/:file",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { folder, file } = req.params;
      const primaryPath = path.join(certificatesRoot, folder, file);

      if (fs.existsSync(primaryPath)) {
        return res.sendFile(primaryPath);
      }

      const legacyPath = path.join(uploadsRoot, folder, file);
      if (fs.existsSync(legacyPath)) {
        const targetDir = path.dirname(primaryPath);
        ensureDirectory(targetDir);
        try {
          fs.renameSync(legacyPath, primaryPath);
          return res.sendFile(primaryPath);
        } catch (err) {
          console.error("Failed to migrate legacy certificate file", err);
          return res.sendFile(legacyPath);
        }
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

// Serve static files for all upload types with detailed logging
app.use("/uploads", (req, res, next) => {
  const requestedPath = path.join(uploadsRoot, req.path);
  console.log(`📁 Static file request: ${req.path}`);
  console.log(`   Full path: ${requestedPath}`);
  console.log(`   Exists: ${fs.existsSync(requestedPath)}`);
  next();
}, express.static(uploadsRoot));

// Specific routes for different upload types (with better error handling)
app.get('/uploads/onduty-documents/:filename', (req: Request, res: Response) => {
  const filePath = path.join(onDutyDocumentsRoot, req.params.filename);
  console.log(`📄 On-duty document request: ${req.params.filename}`);
  console.log(`   Path: ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.log(`   ❌ File not found`);
    res.status(404).json({ 
      success: false, 
      error: 'File not found',
      requestedFile: req.params.filename
    });
  }
});

app.get('/uploads/onduty-selfies/:filename', (req: Request, res: Response) => {
  const filePath = path.join(onDutySelfiesRoot, req.params.filename);
  console.log(`🤳 On-duty selfie request: ${req.params.filename}`);
  console.log(`   Path: ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.log(`   ❌ File not found`);
    res.status(404).json({ 
      success: false, 
      error: 'File not found',
      requestedFile: req.params.filename
    });
  }
});

app.get('/uploads/attendance-photos/:filename', (req: Request, res: Response) => {
  const filePath = path.join(attendancePhotosRoot, req.params.filename);
  console.log(`📸 Attendance photo request: ${req.params.filename}`);
  console.log(`   Path: ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.log(`   ❌ File not found`);
    res.status(404).json({ 
      success: false, 
      error: 'File not found',
      requestedFile: req.params.filename
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Debug endpoint to check upload directories
app.get("/api/debug/uploads", (req: Request, res: Response) => {
  try {
    const listFilesInDir = (dirPath: string) => {
      if (!fs.existsSync(dirPath)) {
        return { exists: false, files: [] };
      }
      const files = fs.readdirSync(dirPath);
      return {
        exists: true,
        count: files.length,
        files: files.slice(0, 10), // Only list first 10 files
        hasMore: files.length > 10
      };
    };

    res.json({
      success: true,
      uploadsRoot,
      directories: {
        certificates: listFilesInDir(certificatesRoot),
        attendancePhotos: listFilesInDir(attendancePhotosRoot),
        onDutyDocuments: listFilesInDir(onDutyDocumentsRoot),
        onDutySelfies: listFilesInDir(onDutySelfiesRoot),
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Database connection test endpoint
app.get("/api/test-db", async (req: Request, res: Response) => {
  try {
    // Test basic connection with a simple query
    const result = await query("SELECT NOW() as current_time, version() as db_version");
    
    // Get table count
    const tablesResult = await query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    // Get some basic stats
    const statsQueries = await Promise.all([
      query("SELECT COUNT(*) as count FROM users"),
      query("SELECT COUNT(*) as count FROM students"),
      query("SELECT COUNT(*) as count FROM events"),
    ]);

    res.json({
      success: true,
      message: "Database connection successful",
      data: {
        connected: true,
        timestamp: result.rows[0].current_time,
        database: {
          name: process.env.DB_NAME || "student_event_management",
          host: process.env.DB_HOST || "localhost",
          port: process.env.DB_PORT || "5432",
          version: result.rows[0].db_version,
        },
        tables: {
          total: parseInt(tablesResult.rows[0].table_count),
        },
        records: {
          users: parseInt(statsQueries[0].rows[0].count),
          students: parseInt(statsQueries[1].rows[0].count),
          events: parseInt(statsQueries[2].rows[0].count),
        },
      },
    });
  } catch (error: any) {
    console.error("Database connection test failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: {
        message: error.message,
        code: error.code,
        detail: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    });
  }
});

// API Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/students`, studentRoutes);
app.use(`${API_PREFIX}/events`, eventRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/certificates`, certificateRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/onduty`, onDutyRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}${API_PREFIX}`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

// Increase timeout for large file uploads (5 minutes)
server.timeout = 300000;
server.keepAliveTimeout = 300000;
server.headersTimeout = 310000;

export default app;
