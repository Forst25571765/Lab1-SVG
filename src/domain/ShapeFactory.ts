import { Circle } from "./Circle.js";
import { DomainError, unknownShapeType } from "./errors.js";
import { Ellipse } from "./Ellipse.js";
import { Group } from "./Group.js";
import { Line } from "./Line.js";
import { Rect } from "./Rect.js";
import { Shape, toFiniteNumber } from "./Shape.js";
import { Text } from "./Text.js";
import { isRecord, type ShapeOptions } from "./types.js";

export type ShapeSpec =
  | ({ type: "rect"; id: string; x: number; y: number; width: number; height: number } & ShapeOptions)
  | ({ type: "circle"; id: string; cx: number; cy: number; r: number } & ShapeOptions)
  | ({ type: "ellipse"; id: string; cx: number; cy: number; rx: number; ry: number } & ShapeOptions)
  | ({ type: "line"; id: string; x1: number; y1: number; x2: number; y2: number } & ShapeOptions)
  | ({ type: "text"; id: string; x: number; y: number; text: string } & ShapeOptions)
  | ({ type: "g"; id: string } & ShapeOptions);

type ParameterBag = Record<string, unknown>;

export class ShapeFactory {
  public create(input: ShapeSpec): Shape;
  public create(type: string, id: string, ...args: unknown[]): Shape;
  public create(type: string, parameters: ParameterBag): Shape;
  public create(
    input: string | ShapeSpec,
    idOrParameters?: string | ParameterBag,
    ...args: unknown[]
  ): Shape {
    return ShapeFactory.createInternal(input, idOrParameters, ...args);
  }

  public static create(input: ShapeSpec): Shape;
  public static create(type: string, id: string, ...args: unknown[]): Shape;
  public static create(type: string, parameters: ParameterBag): Shape;
  public static create(
    input: string | ShapeSpec,
    idOrParameters?: string | ParameterBag,
    ...args: unknown[]
  ): Shape {
    return ShapeFactory.createInternal(input, idOrParameters, ...args);
  }

  private static createInternal(
    input: string | ShapeSpec,
    idOrParameters?: string | ParameterBag,
    ...args: unknown[]
  ): Shape {
    const { type, id, parameters } = normalizeFactoryInput(input, idOrParameters, args);
    switch (type) {
      case "rect":
        return new Rect(
          id,
          requiredNumber(parameters, "x"),
          requiredNumber(parameters, "y"),
          requiredNumber(parameters, "width"),
          requiredNumber(parameters, "height"),
          styleOptions(parameters),
        );
      case "circle":
        return new Circle(
          id,
          requiredNumber(parameters, "cx"),
          requiredNumber(parameters, "cy"),
          requiredNumber(parameters, "r"),
          styleOptions(parameters),
        );
      case "ellipse":
        return new Ellipse(
          id,
          requiredNumber(parameters, "cx"),
          requiredNumber(parameters, "cy"),
          requiredNumber(parameters, "rx"),
          requiredNumber(parameters, "ry"),
          styleOptions(parameters),
        );
      case "line":
        return new Line(
          id,
          requiredNumber(parameters, "x1"),
          requiredNumber(parameters, "y1"),
          requiredNumber(parameters, "x2"),
          requiredNumber(parameters, "y2"),
          styleOptions(parameters),
        );
      case "text":
        return new Text(
          id,
          requiredNumber(parameters, "x"),
          requiredNumber(parameters, "y"),
          requiredText(parameters, "text"),
          styleOptions(parameters),
        );
      case "g":
        return new Group(id, styleOptions(parameters));
      default:
        throw unknownShapeType(type);
    }
  }
}

function normalizeFactoryInput(
  input: string | ShapeSpec,
  idOrParameters: string | ParameterBag | undefined,
  args: unknown[],
): { type: string; id: string; parameters: ParameterBag } {
  if (typeof input !== "string") {
    const parameters = { ...input } as ParameterBag;
    const type = String(parameters.type);
    const id = requiredText(parameters, "id");
    delete parameters.type;
    delete parameters.id;
    return { type, id, parameters };
  }

  const type = input;
  if (typeof idOrParameters === "string") {
    return { type, id: idOrParameters, parameters: positionalParameters(type, args) };
  }
  if (isRecord(idOrParameters)) {
    const parameters = { ...idOrParameters };
    const id = requiredText(parameters, "id");
    delete parameters.id;
    return { type, id, parameters };
  }
  throw new DomainError("invalid-specification", "shape id is required");
}

function positionalParameters(type: string, args: unknown[]): ParameterBag {
  switch (type) {
    case "rect":
      return { x: args[0], y: args[1], width: args[2], height: args[3], fill: args[4] };
    case "circle":
      return { cx: args[0], cy: args[1], r: args[2], fill: args[3] };
    case "ellipse":
      return { cx: args[0], cy: args[1], rx: args[2], ry: args[3], fill: args[4] };
    case "line":
      return { x1: args[0], y1: args[1], x2: args[2], y2: args[3], stroke: args[4] };
    case "text":
      return { x: args[0], y: args[1], text: args[2] };
    case "g":
      return {};
    default:
      return {};
  }
}

function requiredNumber(parameters: ParameterBag, name: string): number {
  const value = parameters[name];
  if (typeof value !== "number" && typeof value !== "string") {
    throw new DomainError("invalid-specification", `missing numeric parameter: ${name}`);
  }
  return toFiniteNumber(value, name);
}

function requiredText(parameters: ParameterBag, name: string): string {
  const value = parameters[name];
  if (value === undefined || value === null) {
    throw new DomainError("invalid-specification", `missing text parameter: ${name}`);
  }
  return String(value);
}

function styleOptions(parameters: ParameterBag): ShapeOptions {
  const options: ShapeOptions = {};
  if (parameters.fill !== undefined) {
    options.fill = String(parameters.fill);
  }
  if (parameters.stroke !== undefined) {
    options.stroke = String(parameters.stroke);
  }
  if (parameters.strokeWidth !== undefined) {
    options.strokeWidth = requiredNumber(parameters, "strokeWidth");
  } else if (parameters["stroke-width"] !== undefined) {
    options["stroke-width"] = requiredNumber(parameters, "stroke-width");
  }
  return options;
}
