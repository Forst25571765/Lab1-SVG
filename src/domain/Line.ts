import { Shape } from "./Shape.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Line extends Shape {
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

  public move(dx: number, dy: number): void {
    const numericDx = Shape.assertFinite(dx, "dx");
    const numericDy = Shape.assertFinite(dy, "dy");
    this._x1 += numericDx;
    this._y1 += numericDy;
    this._x2 += numericDx;
    this._y2 += numericDy;
  }

  public scale(factor: number): void {
    const numericFactor = Shape.assertScaleFactor(factor);
    this._x1 *= numericFactor;
    this._y1 *= numericFactor;
    this._x2 *= numericFactor;
    this._y2 *= numericFactor;
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
