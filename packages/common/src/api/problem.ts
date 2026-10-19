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
    type: `https://matchledger.local/problems/${code}`,
    title,
    status,
    code,
    detail,
    instance,
    requestId,
    ...(errors && { errors }),
  };
}
