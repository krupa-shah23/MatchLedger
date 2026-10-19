/**
 * Error handling plugin: RFC 9457 problem JSON responses
 */

import type { FastifyInstance, FastifyError } from "fastify";

export type ProblemCode =
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "rate_limited"
  | "service_unavailable"
  | "internal_error";

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: ProblemCode;
  detail: string;
  instance: string;
  requestId: string;
  errors?: Array<{ path: string; message: string }>;
  "Retry-After"?: string;
}

export function buildProblem(
  code: ProblemCode,
  status: number,
  title: string,
  detail: string,
  requestId: string,
  instance = "/",
  errors?: Array<{ path: string; message: string }>
): Problem {
  return {
    type: `about:blank#${code}`,
    title,
    status,
    code,
    detail,
    instance,
    requestId,
    ...(errors && { errors }),
  };
}

export async function registerErrorPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError | Error, req, res) => {
    const requestId = req.id || "unknown";

    // Handle known FastifyError types
    if ("statusCode" in error && "message" in error) {
      const fastifyError = error as FastifyError;
      const status = fastifyError.statusCode || 500;

      if (status < 500) {
        // 4xx errors with detail
        const problem = buildProblem(
          "validation_failed",
          status,
          fastifyError.message,
          fastifyError.message,
          requestId
        );
        return res.status(status).type("application/problem+json").send(problem);
      }
    }

    // Generic 500 error - no stack trace, generic detail
    const problem = buildProblem(
      "internal_error",
      500,
      "Internal Server Error",
      "An unexpected error occurred",
      requestId
    );

    return res.status(500).type("application/problem+json").send(problem);
  });
}
