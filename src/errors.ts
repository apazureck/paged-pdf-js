import type { PagedPdfErrorCode } from "./types.js";

export class PagedPdfError extends Error {
  public readonly code: PagedPdfErrorCode;
  public override readonly cause?: unknown;

  public constructor(
    code: PagedPdfErrorCode,
    message: string,
    options?: { readonly cause?: unknown }
  ) {
    super(message);
    this.name = "PagedPdfError";
    this.code = code;
    this.cause = options?.cause;
  }
}

function abortedError(signal?: AbortSignal): PagedPdfError {
  return new PagedPdfError("ABORTED", "PDF conversion was aborted.", {
    cause: signal?.reason
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortedError(signal);
  }
}

export function waitWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  throwIfAborted(signal);
  if (signal === undefined) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(abortedError(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export function toPagedPdfError(
  error: unknown,
  code: PagedPdfErrorCode,
  message: string
): PagedPdfError {
  if (error instanceof PagedPdfError) {
    return error;
  }

  return new PagedPdfError(code, message, { cause: error });
}
