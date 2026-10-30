import type { Circle } from "./Circle.js";
import type { Ellipse } from "./Ellipse.js";
import type { Group } from "./Group.js";
import type { Line } from "./Line.js";
import type { Rect } from "./Rect.js";
import type { Text } from "./Text.js";

/** Domain-only double dispatch; visitors can project shapes without adding tag switches. */
export interface ShapeVisitor<Result> {
  visitRect(shape: Rect): Result;
  visitCircle(shape: Circle): Result;
  visitEllipse(shape: Ellipse): Result;
  visitLine(shape: Line): Result;
  visitText(shape: Text): Result;
  visitGroup(shape: Group): Result;
}
