import { DomainError, duplicateId, unknownAttribute } from "./errors.js";
import { Shape } from "./Shape.js";
import type { AttributeValue, ShapeOptions } from "./types.js";
import type { Document } from "./Document.js";

export class Group extends Shape {
  private readonly _children: Shape[] = [];

  public constructor(id: string, options: ShapeOptions = {}) {
    super(id, "g", options);
  }

  public override get children(): readonly Shape[] {
    return [...this._children];
  }

  public override getSubtree(): readonly Shape[] {
    return [this, ...this._children.flatMap((child) => child.getSubtree())];
  }

  public override containsDescendant(target: Shape): boolean {
    return this._children.some(
      (child) => child === target || child.containsDescendant(target),
    );
  }

  public addChild(child: Shape, documentOwner: Document | null = null): void {
    this.insertChildAt(child, this._children.length, documentOwner);
  }

  public insertChildAt(
    child: Shape,
    index: number,
    documentOwner: Document | null = null,
  ): void {
    if (child === this || child.containsDescendant(this)) {
      throw new DomainError("cycle", "cannot create a cycle in the shape tree");
    }
    if (child.parent !== null) {
      throw new DomainError("shape-already-attached", "shape already has a parent");
    }
    if (this.ownerDocument !== documentOwner) {
      throw new DomainError(
        "invalid-parent",
        "attached shapes must be modified through Document",
      );
    }
    if (child.ownerDocument !== null && child.ownerDocument !== documentOwner) {
      throw new DomainError("shape-already-attached", "shape already belongs to a document");
    }
    if (documentOwner === null && child.ownerDocument !== null) {
      throw new DomainError("shape-already-attached", "shape already belongs to a document");
    }
    if (!Number.isInteger(index) || index < 0 || index > this._children.length) {
      throw new DomainError("invalid-parent", "child index is out of range");
    }

    const existingIds = new Set(this.getSubtree().map((shape) => shape.id));
    for (const shape of child.getSubtree()) {
      if (existingIds.has(shape.id)) {
        throw duplicateId(shape.id);
      }
      existingIds.add(shape.id);
    }

    this._children.splice(index, 0, child);
    child.setParent(this);
    child.getSubtree().forEach((shape) => shape.setDocumentOwner(documentOwner));
  }

  public removeChild(child: Shape, documentOwner: Document | null = null): number {
    if (this.ownerDocument !== documentOwner) {
      throw new DomainError(
        "invalid-parent",
        "attached shapes must be modified through Document",
      );
    }
    const index = this._children.indexOf(child);
    if (index < 0) {
      throw new DomainError("no-such-shape", `shape is not a child of ${this.id}`);
    }
    this._children.splice(index, 1);
    child.setParent(null);
    return index;
  }

  public indexOf(child: Shape): number {
    return this._children.indexOf(child);
  }

  public move(dx: number, dy: number): void {
    const numericDx = Shape.assertFinite(dx, "dx");
    const numericDy = Shape.assertFinite(dy, "dy");
    for (const child of this._children) {
      child.move(numericDx, numericDy);
    }
  }

  public scale(factor: number): void {
    const numericFactor = Shape.assertScaleFactor(factor);
    for (const child of this._children) {
      child.scale(numericFactor);
    }
  }

  protected getSpecificAttribute(_attribute: string): AttributeValue | undefined {
    return undefined;
  }

  protected setSpecificAttribute(attribute: string, _value: AttributeValue): void {
    throw unknownAttribute(attribute);
  }
}
