import type { Group } from "./Group.js";
import type { Document } from "./Document.js";
import { DomainError, scaleFactorMustBePositive, unknownAttribute } from "./errors.js";
import type { AttributeValue, ShapeKind, ShapeOptions } from "./types.js";
import { setShapeLocation } from "./internal/treeMutation.js";

export abstract class Shape {
  #parent: Group | null = null;
  #ownerDocument: Document | null = null;
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
    return this.#parent;
  }

  public get ownerDocument(): Document | null {
    return this.#ownerDocument;
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

  public move(dx: number, dy: number): void {
    const numericDx = Shape.assertFinite(dx, "dx");
    const numericDy = Shape.assertFinite(dy, "dy");
    this.applyGeometry((shape) => shape.prepareMove(numericDx, numericDy));
  }

  public scale(factor: number): void {
    const numericFactor = Shape.assertScaleFactor(factor);
    this.applyGeometry((shape) => shape.prepareScale(numericFactor));
  }

  /** Preparation validates every result without mutation; commits only assign checked values. */
  protected abstract prepareMove(dx: number, dy: number): () => void;

  protected abstract prepareScale(factor: number): () => void;

  private applyGeometry(prepare: (shape: Shape) => () => void): void {
    const commits = this.getSubtree().map(prepare);
    for (const commit of commits) {
      commit();
    }
  }

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

  /** @internal Update both links together after Document or detached Group validation. */
  public [setShapeLocation](parent: Group | null, document: Document | null): void {
    this.#parent = parent;
    this.#ownerDocument = document;
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
