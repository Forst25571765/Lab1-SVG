import type { Document, RemovedShape } from "../domain/index.js";
import { DomainError } from "../domain/errors.js";
import { Group } from "../domain/Group.js";
import type { Shape } from "../domain/Shape.js";
import { StatefulCommand } from "./Command.js";
import {
  assertUniqueTargets,
  documentOrder,
  restoreRemovedShapes,
} from "./HierarchyUtils.js";
import { resolveShape, type ShapeTarget } from "./utils.js";

export class GroupCommand extends StatefulCommand {
  private readonly group: Group;
  private parent: Group | null | undefined;
  private groupIndex: number | undefined;
  private removedTargets: RemovedShape[] = [];

  public constructor(
    private readonly document: Document,
    newGroupId: string,
    private readonly targets: readonly ShapeTarget[],
  ) {
    super();
    this.group = new Group(newGroupId);
  }

  public execute(): void {
    this.ensureCanExecute();
    const orderedTargets = this.prepareTargets();
    const parent = this.parent;
    const groupIndex = this.groupIndex;
    if (parent === undefined || groupIndex === undefined) {
      throw new Error("group command has no insertion location");
    }

    const removedTargets: RemovedShape[] = [];
    // Reverse document order also removes each parent's children from right to left.
    const removalTargets = [...orderedTargets].reverse();
    try {
      for (const target of removalTargets) {
        removedTargets.push(this.document.remove(target));
      }
      this.document.addAt(this.group, parent, groupIndex);
      for (const target of orderedTargets) {
        this.document.add(target, this.group);
      }
      this.removedTargets = removedTargets;
      this.markExecuted();
    } catch (error) {
      this.rollback(removedTargets);
      throw error;
    }
  }

  public undo(): void {
    this.ensureCanUndo();
    for (const child of [...this.group.children].reverse()) {
      this.document.remove(child);
    }
    this.document.remove(this.group);
    restoreRemovedShapes(this.document, this.removedTargets);
    this.markUndone();
  }

  private prepareTargets(): Shape[] {
    const resolved = this.targets.map((target) => resolveShape(this.document, target));
    assertUniqueTargets(resolved);
    if (resolved.length === 0) {
      throw new DomainError("invalid-specification", "group requires at least one shape");
    }
    if (this.document.findById(this.group.id) !== undefined) {
      throw new DomainError("duplicate-id", `id already exists: ${this.group.id}`);
    }

    const order = new Map(documentOrder(this.document).map((shape, index) => [shape, index]));
    const orderedTargets = [...resolved].sort(
      (left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0),
    );
    for (const container of orderedTargets) {
      if (!(container instanceof Group)) {
        continue;
      }
      for (const descendant of orderedTargets) {
        if (container !== descendant && container.containsDescendant(descendant)) {
          throw new DomainError(
            "cycle",
            `cannot group a container into its own descendant: ${container.id}`,
          );
        }
      }
    }

    const parent = orderedTargets[0]?.parent ?? null;
    const sameParentTargets = orderedTargets.filter((shape) => shape.parent === parent);
    const groupIndex = Math.min(...sameParentTargets.map((shape) => this.document.indexOf(shape)));
    this.parent = parent;
    this.groupIndex = groupIndex;
    return orderedTargets;
  }

  private rollback(removedTargets: readonly RemovedShape[]): void {
    for (const child of [...this.group.children].reverse()) {
      this.document.remove(child);
    }
    if (this.document.findById(this.group.id) === this.group) {
      this.document.remove(this.group);
    }
    restoreRemovedShapes(this.document, removedTargets);
  }
}
