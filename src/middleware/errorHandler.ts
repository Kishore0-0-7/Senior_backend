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

  const message =
    (err as any).type === "entity.too.large"
      ? "Uploaded data is too large. Please try a smaller photo."
      : err.message || "Internal Server Error";

  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
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
