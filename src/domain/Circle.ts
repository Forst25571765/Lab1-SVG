import { Shape } from "./Shape.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Circle extends Shape {
  private _cx: number;
  private _cy: number;
  private _r: number;

  public constructor(
    id: string,
    cx: number,
    cy: number,
    r: number,
    options: ShapeOptions = {},
  ) {
    super(id, "circle", options);
    this._cx = Shape.assertFinite(cx, "cx");
    this._cy = Shape.assertFinite(cy, "cy");
    this._r = Shape.assertFinite(r, "r");
  }

  public get cx(): number {
    return this._cx;
  }

  public get cy(): number {
    return this._cy;
  }

  public get r(): number {
    return this._r;
  }

  public override get attributes(): Readonly<Record<string, AttributeValue>> {
    return { ...super.attributes, cx: this._cx, cy: this._cy, r: this._r };
  }

  public move(dx: number, dy: number): void {
    this._cx += Shape.assertFinite(dx, "dx");
    this._cy += Shape.assertFinite(dy, "dy");
  }

  public scale(factor: number): void {
    const numericFactor = Shape.assertScaleFactor(factor);
    this._cx *= numericFactor;
    this._cy *= numericFactor;
    this._r *= numericFactor;
  }

  protected getSpecificAttribute(attribute: string): AttributeValue | undefined {
    switch (attribute) {
      case "cx":
        return this._cx;
      case "cy":
        return this._cy;
      case "r":
        return this._r;
      default:
        return undefined;
    }
  }

  protected setSpecificAttribute(attribute: string, value: AttributeValue): void {
    switch (attribute) {
      case "cx":
        this._cx = Shape.assertFinite(value, attribute);
        return;
      case "cy":
        this._cy = Shape.assertFinite(value, attribute);
        return;
      case "r":
        this._r = Shape.assertFinite(value, attribute);
        return;
      default:
        Shape.rejectUnknownAttribute(attribute);
    }
  }
}
