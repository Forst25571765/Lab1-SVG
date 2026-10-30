import type { Command, CommandState } from "./Command.js";
import { CommandStateError } from "./CommandStateError.js";

export abstract class StatefulCommand implements Command {
  protected state: CommandState = "ready";

  public abstract execute(): void;

  public abstract undo(): void;

  protected ensureCanExecute(): void {
    if (this.state === "executed") throw new CommandStateError("command is already executed");
  }

  protected ensureCanUndo(): void {
    if (this.state !== "executed") throw new CommandStateError("command has not been executed");
  }

  protected markExecuted(): void { this.state = "executed"; }

  protected markUndone(): void { this.state = "undone"; }
}
