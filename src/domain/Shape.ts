import type { Group } from "./Group.js";
import type { Document } from "./Document.js";
import { DomainError, scaleFactorMustBePositive, unknownAttribute } from "./errors.js";
import type { AttributeValue, ShapeKind, ShapeOptions } from "./types.js";

export abstract class Shape {
  private _parent: Group | null = null;
  private _ownerDocument: Document | null = null;
  private _fill: string | undefined;
  private _stroke: string | undefined;
  private _strokeWidth: number | undefined;

  protected constructor(
    public readonly id: string,
    public readonly kind: ShapeKind,
    options: ShapeOptions = {},
  ) {
    if (id.trim().length === 0) {
      throw new DomainError("invalid-id", "shape id must not be empty");
    }

    this._fill = options.fill;
    this._stroke = options.stroke;
    const strokeWidth = options.strokeWidth ?? options["stroke-width"];
    if (strokeWidth !== undefined) {
      this._strokeWidth = toFiniteNumber(strokeWidth, "stroke-width");
    }
  }

  public get type(): ShapeKind {
    return this.kind;
  }

  public get parent(): Group | null {
    return this._parent;
  }

  public get ownerDocument(): Document | null {
    return this._ownerDocument;
  }

  public get fill(): string | undefined {
    return this._fill;
  }

  public get stroke(): string | undefined {
    return this._stroke;
  }

  public get strokeWidth(): number | undefined {
    return this._strokeWidth;
  }

  public get children(): readonly Shape[] {
    return [];
  }

  public getChildren(): readonly Shape[] {
    return this.children;
  }

  public get attributes(): Readonly<Record<string, AttributeValue>> {
    const attributes: Record<string, AttributeValue> = {};
    if (this._fill !== undefined) {
      attributes.fill = this._fill;
    }
    if (this._stroke !== undefined) {
      attributes.stroke = this._stroke;
    }
    if (this._strokeWidth !== undefined) {
      attributes["stroke-width"] = this._strokeWidth;
    }
    return attributes;
  }

  public getAttributes(): Readonly<Record<string, AttributeValue>> {
    return { ...this.attributes };
  }

  public getAttribute(attribute: string): AttributeValue | undefined {
    switch (attribute) {
      case "fill":
        return this._fill;
      case "stroke":
        return this._stroke;
      case "stroke-width":
        return this._strokeWidth;
      default:
        return this.getSpecificAttribute(attribute);
    }
  }

  public setAttribute(attribute: string, value: AttributeValue): void {
    switch (attribute) {
      case "fill":
        this._fill = String(value);
        return;
      case "stroke":
        this._stroke = String(value);
        return;
      case "stroke-width":
        this._strokeWidth = toFiniteNumber(value, attribute);
        return;
      default:
        this.setSpecificAttribute(attribute, value);
    }
  }

  public clearAttribute(attribute: string): void {
    switch (attribute) {
      case "fill":
        this._fill = undefined;
        return;
      case "stroke":
        this._stroke = undefined;
        return;
      case "stroke-width":
        this._strokeWidth = undefined;
        return;
      default:
        this.clearSpecificAttribute(attribute);
    }
  }

  public abstract move(dx: number, dy: number): void;

  public abstract scale(factor: number): void;

  public getSubtree(): readonly Shape[] {
    return [this];
  }

  public containsDescendant(target: Shape): boolean {
    return this.getSubtree().some((shape) => shape !== this && shape === target);
  }

  protected abstract getSpecificAttribute(attribute: string): AttributeValue | undefined;

  protected abstract setSpecificAttribute(attribute: string, value: AttributeValue): void;

  protected clearSpecificAttribute(attribute: string): void {
    Shape.rejectUnknownAttribute(attribute);
  }

  /** @internal Parent links are changed by Document and Group only. */
  public setParent(parent: Group | null): void {
    this._parent = parent;
  }

  /** @internal Document ownership is maintained with the parent links. */
  public setDocumentOwner(document: Document | null): void {
    this._ownerDocument = document;
  }

  protected static assertFinite(value: number | string, label: string): number {
    return toFiniteNumber(value, label);
  }

  protected static assertScaleFactor(factor: number): number {
    const numericFactor = toFiniteNumber(factor, "scale factor");
    if (numericFactor <= 0) {
      throw scaleFactorMustBePositive();
    }
    return numericFactor;
  }

  protected static rejectUnknownAttribute(attribute: string): never {
    throw unknownAttribute(attribute);
  }
}

export function toFiniteNumber(value: number | string, label: string): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new DomainError("invalid-number", `invalid number for ${label}`);
  }
  return numericValue;
}
