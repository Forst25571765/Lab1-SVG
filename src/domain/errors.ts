import { DomainError } from "./DomainError.js";
export { DomainError } from "./DomainError.js";
export type { DomainErrorCode } from "./DomainError.js";

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
