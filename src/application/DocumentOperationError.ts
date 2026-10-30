export type DocumentOperationErrorCode =
  | "no-document"
  | "missing-save-path"
  | "cannot-read-file"
  | "cannot-write-file"
  | "invalid-canvas-arguments";

/** The CLI adds its error: prefix, just as it does for domain/history errors. */
export class DocumentOperationError extends Error {
  public constructor(
    public readonly code: DocumentOperationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DocumentOperationError";
  }
}
