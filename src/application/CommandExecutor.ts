import type { Command } from "../commands/Command.js";
import { CommandHistory } from "./CommandHistory.js";

export class CommandExecutor {
  public constructor(public readonly history = new CommandHistory()) {}

  public execute(command: Command): void {
    command.execute();
    this.history.record(command);
  }

  public undo(): void {
    const command = this.history.peekUndo();
    command.undo();
    this.history.moveUndoToRedo(command);
  }

  public redo(): void {
    const command = this.history.peekRedo();
    command.execute();
    this.history.moveRedoToUndo(command);
  }
}
