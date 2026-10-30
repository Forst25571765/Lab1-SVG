import { DomainError, duplicateId, unknownAttribute } from "./errors.js";
import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";
import type { AttributeValue, ShapeOptions } from "./types.js";
import { insertGroupChild, removeGroupChild, setShapeLocation } from "./internal/treeMutation.js";

export class Group extends Shape {
  public accept<Result>(visitor: ShapeVisitor<Result>): Result { return visitor.visitGroup(this); }

  readonly #children: Shape[] = [];

  public constructor(id: string, options: ShapeOptions = {}) {
    super(id, "g", options);
  }

  public override get children(): readonly Shape[] {
    return [...this.#children];
  }

  public override getSubtree(): readonly Shape[] {
    return [this, ...this.#children.flatMap((child) => child.getSubtree())];
  }

  public override containsDescendant(target: Shape): boolean {
    return this.#children.some(
      (child) => child === target || child.containsDescendant(target),
    );
  }

  public addChild(child: Shape): void {
    this.insertChildAt(child, this.#children.length);
  }

  public insertChildAt(child: Shape, index: number): void {
    this.assertDetached();
    if (child === this || child.containsDescendant(this)) {
      throw new DomainError("cycle", "cannot create a cycle in the shape tree");
    }
    if (child.parent !== null) {
      throw new DomainError("shape-already-attached", "shape already has a parent");
    }
    const incoming = child.getSubtree();
    if (incoming.some((shape) => shape.ownerDocument !== null)) {
      throw new DomainError("shape-already-attached", "shape already belongs to a document");
    }
    if (!Number.isInteger(index) || index < 0 || index > this.#children.length) {
      throw new DomainError("invalid-parent", "child index is out of range");
    }

    let root: Shape = this;
    while (root.parent !== null) {
      root = root.parent;
    }
    const existingIds = new Set(root.getSubtree().map((shape) => shape.id));
    for (const shape of incoming) {
      if (existingIds.has(shape.id)) {
        throw duplicateId(shape.id);
      }
      existingIds.add(shape.id);
    }

    this[insertGroupChild](child, index);
  }

  public removeChild(child: Shape): number {
    this.assertDetached();
    return this[removeGroupChild](child);
  }

  private assertDetached(): void {
    if (this.ownerDocument !== null) {
      throw new DomainError(
        "invalid-parent",
        "attached shapes must be modified through Document",
      );
    }
  }

  /** @internal The caller validates ownership, IDs, cycles and insertion position first. */
  public [insertGroupChild](child: Shape, index: number): void {
    this.#children.splice(index, 0, child);
    for (const shape of child.getSubtree()) {
      shape[setShapeLocation](shape === child ? this : shape.parent, this.ownerDocument);
    }
  }

  /** @internal Document checks membership before removing an attached child. */
  public [removeGroupChild](child: Shape): number {
    const index = this.#children.indexOf(child);
    if (index < 0) {
      throw new DomainError("no-such-shape", `shape is not a child of ${this.id}`);
    }
    this.#children.splice(index, 1);
    for (const shape of child.getSubtree()) {
      shape[setShapeLocation](shape === child ? null : shape.parent, null);
    }
    return index;
  }

  public indexOf(child: Shape): number {
    return this.#children.indexOf(child);
  }

  protected prepareMove(_dx: number, _dy: number): () => void {
    // Group has no local geometry; Shape prepares all descendants before committing.
    return () => {};
  }

  protected prepareScale(_factor: number): () => void {
    return () => {};
  }

  protected getSpecificAttribute(_attribute: string): AttributeValue | undefined {
    return undefined;
  }

  protected setSpecificAttribute(attribute: string, _value: AttributeValue): void {
    throw unknownAttribute(attribute);
  }
}
