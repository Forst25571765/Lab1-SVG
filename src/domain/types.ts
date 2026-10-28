export type ShapeKind = "rect" | "circle" | "ellipse" | "line" | "text" | "g";

export type AttributeValue = string | number;

export interface ShapeOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  "stroke-width"?: number | string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
