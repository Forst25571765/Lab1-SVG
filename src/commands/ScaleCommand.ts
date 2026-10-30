import type { Document, Shape } from "../domain/index.js";
import { GeometryCommand } from "./GeometryCommand.js";
import type { ShapeTarget } from "./utils.js";

export class ScaleCommand extends GeometryCommand {
  public constructor(
    document: Document,
    target: ShapeTarget,
    private readonly factor: number,
  ) {
    super(document, target);
  }

  protected transform(shape: Shape): void {
    shape.scale(this.factor);
  }
}
