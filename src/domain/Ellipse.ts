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

  protected prepareMove(dx: number, dy: number): () => void {
    const cx = Shape.assertFinite(this._cx + dx, "cx");
    const cy = Shape.assertFinite(this._cy + dy, "cy");
    return () => {
      this._cx = cx;
      this._cy = cy;
    };
  }

  protected prepareScale(factor: number): () => void {
    const cx = Shape.assertFinite(this._cx * factor, "cx");
    const cy = Shape.assertFinite(this._cy * factor, "cy");
    const rx = Shape.assertFinite(this._rx * factor, "rx");
    const ry = Shape.assertFinite(this._ry * factor, "ry");
    return () => {
      this._cx = cx;
      this._cy = cy;
      this._rx = rx;
      this._ry = ry;
    };
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
