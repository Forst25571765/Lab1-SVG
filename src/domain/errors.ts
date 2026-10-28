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

/**
 * Domain errors deliberately do not contain the CLI's `error:` prefix.
 * The later CLI layer can map this stable message to its output contract.
 */
export class DomainError extends Error {
  public readonly code: DomainErrorCode;

  public constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function duplicateId(id: string): DomainError {
  return new DomainError("duplicate-id", `id already exists: ${id}`);
}

export function noSuchShape(id: string): DomainError {
  return new DomainError("no-such-shape", `no such shape: ${id}`);
}

export function noSuchContainer(id: string): DomainError {
  return new DomainError("no-such-container", `no such container: ${id}`);
}

export function notAContainer(id: string): DomainError {
  return new DomainError("not-a-container", `not a container: ${id}`);
}

export function unknownShapeType(type: string): DomainError {
  return new DomainError(
    "unknown-shape-type",
    `unknown shape type: ${type} (is the plugin loaded?)`,
  );
}

export function unknownAttribute(attribute: string): DomainError {
  return new DomainError("invalid-attribute", `unknown attribute: ${attribute}`);
}

export function scaleFactorMustBePositive(): DomainError {
  return new DomainError("scale-factor-not-positive", "scale factor must be positive");
}
