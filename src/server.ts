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

// Import routes
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import studentRoutes from "./routes/student.routes";
import eventRoutes from "./routes/event.routes";
import attendanceRoutes from "./routes/attendance.routes";
import certificateRoutes from "./routes/certificate.routes";
import analyticsRoutes from "./routes/analytics.routes";

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

const ensureDirectory = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDirectory(uploadsRoot);
ensureDirectory(certificatesRoot);
ensureDirectory(attendancePhotosRoot);

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

app.use("/uploads", express.static(uploadsRoot));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/students`, studentRoutes);
app.use(`${API_PREFIX}/events`, eventRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/certificates`, certificateRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}${API_PREFIX}`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

export default app;
