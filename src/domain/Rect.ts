import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Rect extends Shape {
  public accept<Result>(visitor: ShapeVisitor<Result>): Result { return visitor.visitRect(this); }

  private _x: number;
  private _y: number;
  private _width: number;
  private _height: number;

  public constructor(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: ShapeOptions = {},
  ) {
    super(id, "rect", options);
    this._x = Shape.assertFinite(x, "x");
    this._y = Shape.assertFinite(y, "y");
    this._width = Shape.assertNonNegative(width, "width");
    this._height = Shape.assertNonNegative(height, "height");
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public override get attributes(): Readonly<Record<string, AttributeValue>> {
    return { ...super.attributes, x: this._x, y: this._y, width: this._width, height: this._height };
  }

  protected prepareMove(dx: number, dy: number): () => void {
    const x = Shape.assertFinite(this._x + dx, "x");
    const y = Shape.assertFinite(this._y + dy, "y");
    return () => {
      this._x = x;
      this._y = y;
    };
  }

  protected prepareScale(factor: number): () => void {
    const x = Shape.assertFinite(this._x * factor, "x");
    const y = Shape.assertFinite(this._y * factor, "y");
    const width = Shape.assertNonNegative(this._width * factor, "width");
    const height = Shape.assertNonNegative(this._height * factor, "height");
    return () => {
      this._x = x;
      this._y = y;
      this._width = width;
      this._height = height;
    };
  }

  protected getSpecificAttribute(attribute: string): AttributeValue | undefined {
    switch (attribute) {
      case "x":
        return this._x;
      case "y":
        return this._y;
      case "width":
        return this._width;
      case "height":
        return this._height;
      default:
        return undefined;
    }
  }

  protected setSpecificAttribute(attribute: string, value: AttributeValue): void {
    switch (attribute) {
      case "x":
        this._x = Shape.assertFinite(value, attribute);
        return;
      case "y":
        this._y = Shape.assertFinite(value, attribute);
        return;
      case "width":
        this._width = Shape.assertNonNegative(value, attribute);
        return;
      case "height":
        this._height = Shape.assertNonNegative(value, attribute);
        return;
      default:
        Shape.rejectUnknownAttribute(attribute);
    }
  }
}
