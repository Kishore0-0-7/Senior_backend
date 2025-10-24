import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode;

  if (typeof (err as any).status === "number") {
    statusCode = (err as any).status;
  }

  if ((err as any).type === "entity.too.large") {
    statusCode = 413;
  }

  if (!statusCode) {
    statusCode = 500;
  }

  let message =
    (err as any).type === "entity.too.large"
      ? "Uploaded data is too large. Please try a smaller photo."
      : err.message || "Internal Server Error";

  // Handle PostgreSQL foreign key constraint violations
  if ((err as any).code === "23503") {
    statusCode = 400;
    const constraint = (err as any).constraint || "";
    
    // Provide user-friendly messages for specific constraints
    if (constraint.includes("student_id")) {
      message = "Student profile not found. Please complete your profile setup or contact administrator.";
    } else if (constraint.includes("event_id")) {
      message = "Event not found. The event may have been deleted.";
    } else if (constraint.includes("admin_id")) {
      message = "Administrator not found.";
    } else {
      message = "Invalid reference in request. Please check your data and try again.";
    }
  }

  // Handle PostgreSQL unique constraint violations
  if ((err as any).code === "23505") {
    statusCode = 409;
    const detail = (err as any).detail || "";
    
    if (detail.includes("email")) {
      message = "Email address already exists.";
    } else if (detail.includes("registration_number")) {
      message = "Registration number already exists.";
    } else {
      message = "Duplicate entry. This record already exists.";
    }
  }

  // Handle PostgreSQL check constraint violations
  if ((err as any).code === "23514") {
    statusCode = 400;
    message = "Invalid data value. Please check your input and try again.";
  }

  // Handle PostgreSQL not-null constraint violations
  if ((err as any).code === "23502") {
    statusCode = 400;
    const column = (err as any).column || "field";
    message = `Required field '${column}' is missing.`;
  }

  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    code: (err as any).code,
    constraint: (err as any).constraint,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === "development" && { 
        stack: err.stack,
        code: (err as any).code,
        constraint: (err as any).constraint,
      }),
    },
  });
};

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
