import { duplicateId, notAContainer } from "../domain/errors.js";
import type { Document, RemovedShape } from "../domain/Document.js";
import { Group } from "../domain/Group.js";
import { Shape } from "../domain/Shape.js";
import { resolveShape, type ShapeTarget } from "./utils.js";

export function resolveGroup(document: Document, target: ShapeTarget): Group {
  const shape = resolveShape(document, target);
  if (!(shape instanceof Group)) {
    throw notAContainer(shape.id);
  }
  return shape;
}

export function assertUniqueTargets(targets: readonly Shape[]): void {
  const seen = new Set<string>();
  for (const target of targets) {
    if (seen.has(target.id)) {
      throw duplicateId(target.id);
    }
    seen.add(target.id);
  }
}

export function documentOrder(document: Document): Shape[] {
  return document.children.flatMap((child) => child.getSubtree());
}

export function restoreRemovedShapes(
  document: Document,
  removedShapes: readonly RemovedShape[],
): void {
  [...removedShapes]
    .sort((left, right) => left.index - right.index)
    .forEach((removed) => document.restore(removed));
}

export function removeChildrenFromDocument(
  document: Document,
  children: readonly Shape[],
): void {
  [...children].reverse().forEach((child) => document.remove(child));
}
