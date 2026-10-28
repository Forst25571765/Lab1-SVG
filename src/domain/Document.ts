import { Group } from "./Group.js";
import { DomainError, duplicateId, noSuchContainer, noSuchShape, notAContainer } from "./errors.js";
import { Shape, toFiniteNumber } from "./Shape.js";

export type ShapeParent = Group | string | null | undefined;

export interface RemovedShape {
  shape: Shape;
  parent: Group | null;
  index: number;
}

export class Document {
  private _width: number;
  private _height: number;
  private readonly _children: Shape[] = [];

  public constructor(width = 800, height = 600) {
    this._width = toFiniteNumber(width, "width");
    this._height = toFiniteNumber(height, "height");
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
    return [...this._children];
  }

  public get rootChildren(): readonly Shape[] {
    return this.children;
  }

  public get size(): number {
    return this._children.reduce((count, child) => count + child.getSubtree().length, 0);
  }

  public setCanvasSize(width: number, height: number): void {
    this._width = toFiniteNumber(width, "width");
    this._height = toFiniteNumber(height, "height");
  }

  public add(shape: Shape, parent: ShapeParent = null): void {
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
      if (incomingIds.has(incomingShape.id)) {
        throw duplicateId(incomingShape.id);
      }
      incomingIds.add(incomingShape.id);
      if (this.findById(incomingShape.id) !== undefined) {
        throw duplicateId(incomingShape.id);
      }
    }

    if (parentGroup === null) {
      this._children.push(shape);
      shape.getSubtree().forEach((nestedShape) => nestedShape.setDocumentOwner(this));
    } else {
      parentGroup.addChild(shape, this);
    }
  }

  public addShape(shape: Shape, parent: ShapeParent = null): void {
    this.add(shape, parent);
  }

  public findById(id: string): Shape | undefined {
    for (const child of this._children) {
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

  public remove(shapeOrId: Shape | string): RemovedShape {
    const shape = typeof shapeOrId === "string" ? this.requireShape(shapeOrId) : shapeOrId;
    const parent = shape.parent;
    if (parent === null) {
      const index = this._children.indexOf(shape);
      if (index < 0) {
        throw noSuchShape(shape.id);
      }
      this._children.splice(index, 1);
      shape.getSubtree().forEach((nestedShape) => nestedShape.setDocumentOwner(null));
      return { shape, parent: null, index };
    }
    const index = parent.removeChild(shape, this);
    shape.getSubtree().forEach((nestedShape) => nestedShape.setDocumentOwner(null));
    return { shape, parent, index };
  }

  public restore(removed: RemovedShape): void {
    if (removed.parent === null) {
      if (this.findById(removed.shape.id) !== undefined) {
        throw duplicateId(removed.shape.id);
      }
      this._children.splice(removed.index, 0, removed.shape);
      removed.shape.getSubtree().forEach((shape) => shape.setDocumentOwner(this));
      return;
    }
    this.add(removed.shape, removed.parent);
    const currentIndex = removed.parent.indexOf(removed.shape);
    if (currentIndex !== removed.index) {
      removed.parent.removeChild(removed.shape, this);
      removed.parent.insertChildAt(removed.shape, removed.index, this);
    }
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
}
