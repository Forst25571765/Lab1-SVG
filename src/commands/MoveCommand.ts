import type { Document, Shape } from "../domain/index.js";
import { GeometryCommand } from "./GeometryCommand.js";
import type { ShapeTarget } from "./utils.js";

export class MoveCommand extends GeometryCommand {
  public constructor(
    document: Document,
    target: ShapeTarget,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    super(document, target);
  }

  protected transform(shape: Shape): void {
    shape.move(this.dx, this.dy);
  }
}
