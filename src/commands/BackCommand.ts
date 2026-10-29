import type { Document } from "../domain/index.js";
import type { ShapeTarget } from "./utils.js";
import { ZOrderCommand } from "./ZOrderCommand.js";

export class BackCommand extends ZOrderCommand {
  public constructor(document: Document, target: ShapeTarget) {
    super(document, target, "back");
  }
}
