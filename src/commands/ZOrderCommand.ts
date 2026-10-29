import type { Document } from "../domain/index.js";
import { StatefulCommand } from "./Command.js";
import { resolveShape, type ShapeTarget } from "./utils.js";

export type ZOrderDirection = "front" | "back";

export abstract class ZOrderCommand extends StatefulCommand {
  private oldIndex: number | undefined;

  protected constructor(
    protected readonly document: Document,
    protected readonly target: ShapeTarget,
    private readonly direction: ZOrderDirection,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const shape = resolveShape(this.document, this.target);
    this.oldIndex = this.document.indexOf(shape);
    const siblingCount = shape.parent === null
      ? this.document.children.length
      : shape.parent.children.length;
    const targetIndex = this.direction === "front" ? 0 : siblingCount - 1;
    this.document.reorder(shape, targetIndex);
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    if (this.oldIndex === undefined) {
      throw new Error("z-order command has no original index");
    }
    this.document.reorder(this.target, this.oldIndex);
    this.markUndone();
  }
}
