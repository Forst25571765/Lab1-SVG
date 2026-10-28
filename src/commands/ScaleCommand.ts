import type { Document } from "../domain/index.js";
import { StatefulCommand } from "./Command.js";
import {
  captureShapeSnapshot,
  resolveShape,
  restoreShapeSnapshot,
  type ShapeSnapshot,
  type ShapeTarget,
} from "./utils.js";

export class ScaleCommand extends StatefulCommand {
  private snapshot: ShapeSnapshot | undefined;

  public constructor(
    private readonly document: Document,
    private readonly target: ShapeTarget,
    private readonly factor: number,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const shape = resolveShape(this.document, this.target);
    this.snapshot = captureShapeSnapshot(shape);
    shape.scale(this.factor);
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    if (this.snapshot === undefined) {
      throw new Error("scale command has no snapshot");
    }
    restoreShapeSnapshot(this.snapshot);
    this.markUndone();
  }
}
