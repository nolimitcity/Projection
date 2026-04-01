import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../domain/errors.js";

const toValidationErrors = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      type: `https://projection.local/problems/${err.code.toLowerCase()}`,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: req.originalUrl,
      code: err.code,
      ...err.extras
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      type: "https://projection.local/problems/validation-error",
      title: "Bad Request",
      status: 400,
      detail: "Request validation failed.",
      instance: req.originalUrl,
      code: "VALIDATION_ERROR",
      errors: toValidationErrors(err)
    });
  }

  return res.status(500).json({
    type: "https://projection.local/problems/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail: "An unexpected error occurred.",
    instance: req.originalUrl,
    code: "INTERNAL_ERROR"
  });
};
