import { Group } from "./Group.js";
import { DomainError, duplicateId, noSuchContainer, noSuchShape, notAContainer } from "./errors.js";
import { Shape, toNonNegativeNumber } from "./Shape.js";
import { insertGroupChild, removeGroupChild, setShapeLocation } from "./internal/treeMutation.js";

export type ShapeParent = Group | string | null | undefined;

export interface RemovedShape {
  shape: Shape;
  parent: Group | null;
  index: number;
}

export class Document {
  private _width: number;
  private _height: number;
  readonly #children: Shape[] = [];

  public constructor(width = 800, height = 600) {
    this._width = toNonNegativeNumber(width, "width");
    this._height = toNonNegativeNumber(height, "height");
  }

  public static createEmpty(width = 800, height = 600): Document {
    return new Document(width, height);
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public get children(): readonly Shape[] {
    return [...this.#children];
  }

  public get rootChildren(): readonly Shape[] {
    return this.children;
  }

  public get size(): number {
    return this.#children.reduce((count, child) => count + child.getSubtree().length, 0);
  }

  public setCanvasSize(width: number, height: number): void {
    const nextWidth = toNonNegativeNumber(width, "width");
    const nextHeight = toNonNegativeNumber(height, "height");
    this._width = nextWidth;
    this._height = nextHeight;
  }

  public add(shape: Shape, parent: ShapeParent = null): void {
    this.addAt(shape, parent);
  }

  public addAt(shape: Shape, parent: ShapeParent = null, index?: number): void {
    if (shape.parent !== null) {
      throw new DomainError("shape-already-attached", "shape already has a parent");
    }
    if (shape.ownerDocument !== null) {
      throw new DomainError("shape-already-attached", "shape already belongs to a document");
    }

    const parentGroup = this.resolveParent(parent);
    const incomingShapes = shape.getSubtree();
    const incomingIds = new Set<string>();
    for (const incomingShape of incomingShapes) {
      if (incomingShape.ownerDocument !== null) {
        throw new DomainError("shape-already-attached", "shape already belongs to a document");
      }
      if (incomingIds.has(incomingShape.id)) {
        throw duplicateId(incomingShape.id);
      }
      incomingIds.add(incomingShape.id);
      if (this.findById(incomingShape.id) !== undefined) {
        throw duplicateId(incomingShape.id);
      }
    }

    const siblingCount = parentGroup === null ? this.#children.length : parentGroup.children.length;
    const insertionIndex = index ?? siblingCount;
    this.assertInsertionIndex(insertionIndex, siblingCount);
    if (parentGroup === null) {
      this.#children.splice(insertionIndex, 0, shape);
      for (const nestedShape of incomingShapes) {
        nestedShape[setShapeLocation](nestedShape.parent, this);
      }
    } else {
      parentGroup[insertGroupChild](shape, insertionIndex);
    }
  }

  public addShape(shape: Shape, parent: ShapeParent = null): void {
    this.add(shape, parent);
  }

  public findById(id: string): Shape | undefined {
    for (const child of this.#children) {
      const found = child.getSubtree().find((shape) => shape.id === id);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  public find(id: string): Shape | undefined {
    return this.findById(id);
  }

  public requireShape(id: string): Shape {
    const shape = this.findById(id);
    if (shape === undefined) {
      throw noSuchShape(id);
    }
    return shape;
  }

  public findContainerById(id: string): Group | undefined {
    const shape = this.findById(id);
    return shape instanceof Group ? shape : undefined;
  }

  public requireContainer(id: string): Group {
    const shape = this.requireShape(id);
    if (!(shape instanceof Group)) {
      throw notAContainer(id);
    }
    return shape;
  }

  public indexOf(shape: Shape): number {
    if (this.findById(shape.id) !== shape) {
      throw noSuchShape(shape.id);
    }
    return shape.parent === null
      ? this.#children.indexOf(shape)
      : shape.parent.indexOf(shape);
  }

  public reorder(shapeOrId: Shape | string, index: number): void {
    const shape = typeof shapeOrId === "string" ? this.requireShape(shapeOrId) : shapeOrId;
    const currentIndex = this.indexOf(shape);
    const siblings = shape.parent === null ? this.#children : shape.parent.children;
    this.assertInsertionIndex(index, siblings.length - 1);
    if (currentIndex === index) {
      return;
    }

    if (shape.parent === null) {
      this.#children.splice(currentIndex, 1);
      this.#children.splice(index, 0, shape);
      return;
    }

    const parent = shape.parent;
    parent[removeGroupChild](shape);
    parent[insertGroupChild](shape, index);
  }

  public remove(shapeOrId: Shape | string): RemovedShape {
    const shape = typeof shapeOrId === "string" ? this.requireShape(shapeOrId) : shapeOrId;
    const index = this.indexOf(shape);
    const parent = shape.parent;
    if (parent === null) {
      this.#children.splice(index, 1);
      for (const nestedShape of shape.getSubtree()) {
        nestedShape[setShapeLocation](nestedShape.parent, null);
      }
      return { shape, parent: null, index };
    }
    parent[removeGroupChild](shape);
    return { shape, parent, index };
  }

  public restore(removed: RemovedShape): void {
    this.addAt(removed.shape, removed.parent, removed.index);
  }

  private resolveParent(parent: ShapeParent): Group | null {
    if (parent === null || parent === undefined) {
      return null;
    }
    if (typeof parent === "string") {
      const shape = this.findById(parent);
      if (shape === undefined) {
        throw noSuchContainer(parent);
      }
      if (!(shape instanceof Group)) {
        throw notAContainer(parent);
      }
      return shape;
    }
    if (this.findById(parent.id) !== parent) {
      throw noSuchContainer(parent.id);
    }
    return parent;
  }

  private assertInsertionIndex(index: number, length: number): void {
    if (!Number.isInteger(index) || index < 0 || index > length) {
      throw new DomainError("invalid-parent", "sibling index is out of range");
    }
  }
}
