import type { Document, RemovedShape } from "../domain/index.js";
import { DomainError } from "../domain/errors.js";
import { Group } from "../domain/Group.js";
import { StatefulCommand } from "./Command.js";
import { resolveGroup } from "./HierarchyUtils.js";
import { resolveShape, type ShapeTarget } from "./utils.js";

export class AddToCommand extends StatefulCommand {
  private removed: RemovedShape | undefined;

  public constructor(
    private readonly document: Document,
    private readonly groupTarget: ShapeTarget,
    private readonly shapeTarget: ShapeTarget,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const group = resolveGroup(this.document, this.groupTarget);
    const shape = resolveShape(this.document, this.shapeTarget);
    this.validateTarget(group, shape);

    const removed = this.document.remove(shape);
    try {
      this.document.addAt(shape, group, group.children.length);
      this.removed = removed;
      this.markExecuted();
    } catch (error) {
      this.document.restore(removed);
      throw error;
    }
  }

  public undo(): void {
    this.ensureCanUndo();
    if (this.removed === undefined) {
      throw new Error("addto command has no removed state");
    }
    this.document.remove(this.shapeTarget);
    this.document.restore(this.removed);
    this.markUndone();
  }

  private validateTarget(group: Group, shape: import("../domain/Shape.js").Shape): void {
    if (group === shape) {
      throw new DomainError(
        "cycle",
        `cannot move a container into its own descendant: ${shape.id}`,
      );
    }
    if (shape instanceof Group && shape.containsDescendant(group)) {
      throw new DomainError(
        "cycle",
        `cannot move a container into its own descendant: ${shape.id}`,
      );
    }
  }
}
