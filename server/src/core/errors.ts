import type {ErrorRequestHandler} from 'express';
import {ZodError} from 'zod';

export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details: unknown = {}) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({error: {code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.flatten()}});
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({error: {code: error.code, message: error.message, details: error.details}});
    return;
  }
  console.error(error);
  response.status(500).json({error: {code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', details: {}}});
};
