import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Line extends Shape {
  public accept<Result>(visitor: ShapeVisitor<Result>): Result { return visitor.visitLine(this); }

  private _x1: number;
  private _y1: number;
  private _x2: number;
  private _y2: number;

  public constructor(
    id: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: ShapeOptions = {},
  ) {
    super(id, "line", options);
    this._x1 = Shape.assertFinite(x1, "x1");
    this._y1 = Shape.assertFinite(y1, "y1");
    this._x2 = Shape.assertFinite(x2, "x2");
    this._y2 = Shape.assertFinite(y2, "y2");
  }

  public get x1(): number {
    return this._x1;
  }

  public get y1(): number {
    return this._y1;
  }

  public get x2(): number {
    return this._x2;
  }

  public get y2(): number {
    return this._y2;
  }

  public override get attributes(): Readonly<Record<string, AttributeValue>> {
    return { ...super.attributes, x1: this._x1, y1: this._y1, x2: this._x2, y2: this._y2 };
  }

  protected prepareMove(dx: number, dy: number): () => void {
    const x1 = Shape.assertFinite(this._x1 + dx, "x1");
    const y1 = Shape.assertFinite(this._y1 + dy, "y1");
    const x2 = Shape.assertFinite(this._x2 + dx, "x2");
    const y2 = Shape.assertFinite(this._y2 + dy, "y2");
    return () => {
      this._x1 = x1;
      this._y1 = y1;
      this._x2 = x2;
      this._y2 = y2;
    };
  }

  protected prepareScale(factor: number): () => void {
    const x1 = Shape.assertFinite(this._x1 * factor, "x1");
    const y1 = Shape.assertFinite(this._y1 * factor, "y1");
    const x2 = Shape.assertFinite(this._x2 * factor, "x2");
    const y2 = Shape.assertFinite(this._y2 * factor, "y2");
    return () => {
      this._x1 = x1;
      this._y1 = y1;
      this._x2 = x2;
      this._y2 = y2;
    };
  }

  protected getSpecificAttribute(attribute: string): AttributeValue | undefined {
    switch (attribute) {
      case "x1":
        return this._x1;
      case "y1":
        return this._y1;
      case "x2":
        return this._x2;
      case "y2":
        return this._y2;
      default:
        return undefined;
    }
  }

  protected setSpecificAttribute(attribute: string, value: AttributeValue): void {
    switch (attribute) {
      case "x1":
        this._x1 = Shape.assertFinite(value, attribute);
        return;
      case "y1":
        this._y1 = Shape.assertFinite(value, attribute);
        return;
      case "x2":
        this._x2 = Shape.assertFinite(value, attribute);
        return;
      case "y2":
        this._y2 = Shape.assertFinite(value, attribute);
        return;
      default:
        Shape.rejectUnknownAttribute(attribute);
    }
  }
}
