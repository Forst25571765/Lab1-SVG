import type { Document, RemovedShape } from "../domain/index.js";
import { StatefulCommand } from "./Command.js";
import { resolveShape, type ShapeTarget } from "./utils.js";

export class DeleteCommand extends StatefulCommand {
  private removed: RemovedShape | undefined;

  public constructor(
    private readonly document: Document,
    private readonly target: ShapeTarget,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const shape = this.removed?.shape ?? resolveShape(this.document, this.target);
    this.removed = this.document.remove(shape);
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    if (this.removed === undefined) {
      throw new Error("delete command has no removed shape");
    }
    this.document.restore(this.removed);
    this.markUndone();
  }
}
