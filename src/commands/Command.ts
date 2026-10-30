export interface Command {
  execute(): void;
  undo(): void;
}

export type CommandState = "ready" | "executed" | "undone";

// Preserve the existing import path while keeping each class in its own file.
export { StatefulCommand } from "./StatefulCommand.js";
