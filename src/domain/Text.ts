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
    return () => {
      this._x = x;
      this._y = y;
    };
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
