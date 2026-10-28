import { Shape } from "./Shape.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Ellipse extends Shape {
  private _cx: number;
  private _cy: number;
  private _rx: number;
  private _ry: number;

  public constructor(
    id: string,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    options: ShapeOptions = {},
  ) {
    super(id, "ellipse", options);
    this._cx = Shape.assertFinite(cx, "cx");
    this._cy = Shape.assertFinite(cy, "cy");
    this._rx = Shape.assertFinite(rx, "rx");
    this._ry = Shape.assertFinite(ry, "ry");
  }

  public get cx(): number {
    return this._cx;
  }

  public get cy(): number {
    return this._cy;
  }

  public get rx(): number {
    return this._rx;
  }

  public get ry(): number {
    return this._ry;
  }

  public override get attributes(): Readonly<Record<string, AttributeValue>> {
    return { ...super.attributes, cx: this._cx, cy: this._cy, rx: this._rx, ry: this._ry };
  }

  public move(dx: number, dy: number): void {
    this._cx += Shape.assertFinite(dx, "dx");
    this._cy += Shape.assertFinite(dy, "dy");
  }

  public scale(factor: number): void {
    const numericFactor = Shape.assertScaleFactor(factor);
    this._cx *= numericFactor;
    this._cy *= numericFactor;
    this._rx *= numericFactor;
    this._ry *= numericFactor;
  }

  protected getSpecificAttribute(attribute: string): AttributeValue | undefined {
    switch (attribute) {
      case "cx":
        return this._cx;
      case "cy":
        return this._cy;
      case "rx":
        return this._rx;
      case "ry":
        return this._ry;
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
      case "rx":
        this._rx = Shape.assertFinite(value, attribute);
        return;
      case "ry":
        this._ry = Shape.assertFinite(value, attribute);
        return;
      default:
        Shape.rejectUnknownAttribute(attribute);
    }
  }
}
