import { NextResponse } from 'next/server';
import type { ApiErrorResponse } from '@/types/api';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorResponse(error: AppError): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, details: error.details } },
    { status: error.statusCode },
  );
}

export function internalError(): NextResponse<ApiErrorResponse> {
  return errorResponse(new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred'));
}
