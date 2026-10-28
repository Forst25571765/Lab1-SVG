import type { Document, RemovedShape, ShapeParent } from "../domain/index.js";
import { Shape } from "../domain/Shape.js";
import { StatefulCommand } from "./Command.js";

export class CreateCommand extends StatefulCommand {
  private removed: RemovedShape | undefined;

  public constructor(
    private readonly document: Document,
    public readonly shape: Shape,
    private readonly parent: ShapeParent = null,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    if (this.removed === undefined) {
      this.document.add(this.shape, this.parent);
    } else {
      this.document.restore(this.removed);
    }
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    this.removed = this.document.remove(this.shape);
    this.markUndone();
  }
}
