import type { AttributeValue } from "../domain/index.js";
import type { Document } from "../domain/index.js";
import { StatefulCommand } from "./Command.js";
import { resolveShape, type ShapeTarget } from "./utils.js";

export class SetCommand extends StatefulCommand {
  private targetShape: ReturnType<typeof resolveShape> | undefined;
  private oldValue: AttributeValue | undefined;
  private hadOldValue = false;

  public constructor(
    private readonly document: Document,
    private readonly target: ShapeTarget,
    private readonly attribute: string,
    private readonly value: AttributeValue,
  ) {
    super();
  }

  public execute(): void {
    this.ensureCanExecute();
    const shape = resolveShape(this.document, this.target);
    const attributes = shape.getAttributes();
    this.targetShape = shape;
    this.hadOldValue = Object.prototype.hasOwnProperty.call(attributes, this.attribute);
    this.oldValue = attributes[this.attribute];
    shape.setAttribute(this.attribute, this.value);
    this.markExecuted();
  }

  public undo(): void {
    this.ensureCanUndo();
    if (this.targetShape === undefined) {
      throw new Error("set command has no target");
    }
    if (this.hadOldValue) {
      this.targetShape.setAttribute(this.attribute, this.oldValue as AttributeValue);
    } else {
      this.targetShape.clearAttribute(this.attribute);
    }
    this.markUndone();
  }
}
