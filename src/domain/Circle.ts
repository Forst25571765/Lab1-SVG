import { Shape } from "./Shape.js";
import type { ShapeVisitor } from "./ShapeVisitor.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Circle extends Shape {
  public accept<Result>(visitor: ShapeVisitor<Result>): Result { return visitor.visitCircle(this); }

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
    const r = Shape.assertFinite(this._r * factor, "r");
    return () => {
      this._cx = cx;
      this._cy = cy;
      this._r = r;
    };
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
