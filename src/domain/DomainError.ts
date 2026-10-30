export type DomainErrorCode =
  | "invalid-id"
  | "invalid-number"
  | "invalid-attribute"
  | "invalid-specification"
  | "duplicate-id"
  | "no-such-shape"
  | "no-such-container"
  | "not-a-container"
  | "shape-already-attached"
  | "cycle"
  | "unknown-shape-type"
  | "scale-factor-not-positive"
  | "invalid-parent";

/** Domain messages omit the CLI's error prefix. */
export class DomainError extends Error {
  public constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
  }
}
