import type { Document } from "../domain/index.js";
import { DomainError } from "../domain/errors.js";
import { Group } from "../domain/Group.js";
import type { Shape } from "../domain/Shape.js";
import { StatefulCommand } from "./Command.js";
import { removeChildrenFromDocument, resolveGroup } from "./HierarchyUtils.js";
import type { ShapeTarget } from "./utils.js";

export class UngroupCommand extends StatefulCommand {
  private group: Group | undefined;
  private parent: Group | undefined;
  private groupIndex: number | undefined;
  private children: readonly Shape[] = [];

  public constructor(
    private readonly document: Document,
    private readonly target: ShapeTarget,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const group = this.group ?? resolveGroup(this.document, this.target);
    if (group.parent === null) {
      throw new DomainError(
        "invalid-parent",
        `cannot ungroup top-level container: ${group.id}`,
      );
    }

    if (this.group === undefined) {
      this.group = group;
      this.parent = group.parent;
      this.groupIndex = group.parent.indexOf(group);
      this.children = [...group.children];
    }

    if (this.parent === undefined || this.groupIndex === undefined) {
      throw new Error("ungroup command has no parent location");
    }

    removeChildrenFromDocument(this.document, this.children);
    this.document.remove(group);
    for (const [offset, child] of this.children.entries()) {
      this.document.addAt(child, this.parent, this.groupIndex + offset);
    }
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    if (
      this.group === undefined ||
      this.parent === undefined ||
      this.groupIndex === undefined
    ) {
      throw new Error("ungroup command has no saved state");
    }

    removeChildrenFromDocument(this.document, this.children);
    this.document.addAt(this.group, this.parent, this.groupIndex);
    for (const child of this.children) {
      this.group.addChild(child, this.document);
    }
    this.markUndone();
  }
}
