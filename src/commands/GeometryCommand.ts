import type { Document, Shape } from "../domain/index.js";
import { StatefulCommand } from "./StatefulCommand.js";
import { captureShapeSnapshot, resolveShape, restoreShapeSnapshot, type ShapeSnapshot, type ShapeTarget } from "./utils.js";

/** Shared snapshot lifecycle; each concrete command delegates its operation to Shape. */
export abstract class GeometryCommand extends StatefulCommand {
  private snapshot: ShapeSnapshot | undefined;

  protected constructor(
    private readonly document: Document,
    private readonly target: ShapeTarget,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const shape = resolveShape(this.document, this.target);
    const snapshot = captureShapeSnapshot(shape);
    this.transform(shape);
    this.snapshot = snapshot;
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    if (this.snapshot === undefined) throw new Error("geometry command has no snapshot");
    restoreShapeSnapshot(this.snapshot);
    this.markUndone();
  }

  protected abstract transform(shape: Shape): void;
}
