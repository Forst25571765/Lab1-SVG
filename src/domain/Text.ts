import { Shape } from "./Shape.js";
import type { AttributeValue, ShapeOptions } from "./types.js";

export class Text extends Shape {
  private _x: number;
  private _y: number;
  private _content: string;

  public constructor(
    id: string,
    x: number,
    y: number,
    content: string,
    options: ShapeOptions = {},
  ) {
    super(id, "text", options);
    this._x = Shape.assertFinite(x, "x");
    this._y = Shape.assertFinite(y, "y");
    this._content = content;
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public get content(): string {
    return this._content;
  }

  public get text(): string {
    return this._content;
  }

  public override get attributes(): Readonly<Record<string, AttributeValue>> {
    return { ...super.attributes, x: this._x, y: this._y, text: this._content };
  }

  public move(dx: number, dy: number): void {
    this._x += Shape.assertFinite(dx, "dx");
    this._y += Shape.assertFinite(dy, "dy");
  }

  public scale(factor: number): void {
    const numericFactor = Shape.assertScaleFactor(factor);
    this._x *= numericFactor;
    this._y *= numericFactor;
  }

  protected getSpecificAttribute(attribute: string): AttributeValue | undefined {
    switch (attribute) {
      case "x":
        return this._x;
      case "y":
        return this._y;
      case "text":
        return this._content;
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
      case "text":
        this._content = String(value);
        return;
      default:
        Shape.rejectUnknownAttribute(attribute);
    }
  }
}
