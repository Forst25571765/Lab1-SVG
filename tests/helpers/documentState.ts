import { expect } from "vitest";
import { Document, Group, Shape } from "../../src/domain/index.js";

/** Capture values separately from object references so later mutations cannot change the baseline. */
export function captureDocument(document: Document) {
  const seen = new Set<Shape>();
  const ids = new Set<string>();
  const nodes: Shape[] = [];
  const visit = (shape: Shape, parent: Group | null): void => {
    expect(seen.has(shape), `duplicate node: ${shape.id}`).toBe(false);
    expect(ids.has(shape.id), `duplicate id: ${shape.id}`).toBe(false);
    seen.add(shape);
    ids.add(shape.id);
    nodes.push(shape);
    expect(shape.parent).toBe(parent);
    expect(shape.ownerDocument).toBe(document);
    expect(document.findById(shape.id)).toBe(shape);
    if (shape instanceof Group) {
      for (const child of shape.children) {
        visit(child, shape);
      }
    }
  };
  for (const root of document.children) {
    visit(root, null);
  }
  expect(document.size).toBe(nodes.length);
  return {
    width: document.width,
    height: document.height,
    roots: document.children.map((shape) => shape.id),
    values: nodes.map((shape) => ({
      id: shape.id,
      kind: shape.kind,
      parent: shape.parent?.id ?? null,
      attributes: shape.getAttributes(),
      children: shape.children.map((child) => child.id),
    })),
    identities: new Map(nodes.map((shape) => [shape.id, shape])),
  };
}

export function expectDocumentUnchanged(document: Document, before: ReturnType<typeof captureDocument>): void {
  const after = captureDocument(document);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(after.roots).toEqual(before.roots);
  expect(after.values).toEqual(before.values);
  for (const [id, shape] of before.identities) {
    expect(document.findById(id)).toBe(shape);
  }
}
