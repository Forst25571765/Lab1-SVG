import { noSuchShape } from "../domain/errors.js";
import { Document } from "../domain/Document.js";
import { Shape } from "../domain/Shape.js";
import type { AttributeValue } from "../domain/types.js";

export type ShapeTarget = string | Shape;

export interface ShapeSnapshotEntry {
  shape: Shape;
  attributes: Readonly<Record<string, AttributeValue>>;
}

export type ShapeSnapshot = readonly ShapeSnapshotEntry[];

export function resolveShape(document: Document, target: ShapeTarget): Shape {
  if (typeof target === "string") {
    return document.requireShape(target);
  }

  if (document.findById(target.id) !== target) {
    throw noSuchShape(target.id);
  }
  return target;
}

export function captureShapeSnapshot(target: Shape): ShapeSnapshot {
  return target.getSubtree().map((shape) => ({
    shape,
    attributes: { ...shape.getAttributes() },
  }));
}

export function restoreShapeSnapshot(snapshot: ShapeSnapshot): void {
  for (const entry of snapshot) {
    const currentAttributes = entry.shape.getAttributes();
    for (const attribute of Object.keys(currentAttributes)) {
      if (!Object.prototype.hasOwnProperty.call(entry.attributes, attribute)) {
        entry.shape.clearAttribute(attribute);
      }
    }
    for (const [attribute, value] of Object.entries(entry.attributes)) {
      entry.shape.setAttribute(attribute, value);
    }
  }
}
