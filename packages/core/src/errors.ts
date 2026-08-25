export type SemctxErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "REPO_NOT_INDEXED"
  | "TASK_NOT_FOUND"
  | "INVALID_TASK_INPUT"
  | "ANALYSIS_FAILED"
  | "STORE_ERROR"
  | "GIT_ERROR"
  | "GIT_BASE_UNAVAILABLE"
  | "CONTROL_INPUTS_UNSAFE"
  | "IO_ERROR"
  | "UNSUPPORTED";

export interface SemctxErrorJSON {
  name: "SemctxError";
  code: SemctxErrorCode;
  message: string;
  details: Record<string, unknown>;
}

export class SemctxError extends Error {
  readonly code: SemctxErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: SemctxErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "SemctxError";
    this.code = code;
    this.details = details;
  }

  toJSON(): SemctxErrorJSON {
    return { name: "SemctxError", code: this.code, message: this.message, details: this.details };
  }
}

export function isSemctxError(value: unknown): value is SemctxError {
  return value instanceof SemctxError;
}

export interface ErrorWithSuppressed extends Error {
  readonly suppressed: readonly Error[];
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** Preserve a primary failure while retaining structured evidence from a secondary cleanup failure. */
export function attachSuppressedError(primary: unknown, suppressed: unknown): ErrorWithSuppressed {
  const primaryError = normalizeError(primary) as Error & { suppressed?: readonly Error[] };
  const suppressedError = normalizeError(suppressed);
  const previous = primaryError.suppressed ?? [];
  Object.defineProperty(primaryError, "suppressed", {
    configurable: true,
    enumerable: false,
    value: [...previous, suppressedError],
  });
  const combined = primaryError as ErrorWithSuppressed;
  if (combined instanceof SemctxError) {
    combined.details.suppressed = combined.suppressed.map((error) => ({
      name: error.name,
      message: error.message,
    }));
  }
  return combined;
}
