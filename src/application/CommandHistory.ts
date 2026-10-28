import type { Command } from "../commands/Command.js";

export class HistoryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HistoryError";
  }
}

export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  public get undoCount(): number {
    return this.undoStack.length;
  }

  public get redoCount(): number {
    return this.redoStack.length;
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public record(command: Command): void {
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  public peekUndo(): Command {
    const command = this.undoStack[this.undoStack.length - 1];
    if (command === undefined) {
      throw new HistoryError("nothing to undo");
    }
    return command;
  }

  public peekRedo(): Command {
    const command = this.redoStack[this.redoStack.length - 1];
    if (command === undefined) {
      throw new HistoryError("nothing to redo");
    }
    return command;
  }

  public moveUndoToRedo(command: Command): void {
    this.assertTop(this.undoStack, command, "undo");
    this.undoStack.pop();
    this.redoStack.push(command);
  }

  public moveRedoToUndo(command: Command): void {
    this.assertTop(this.redoStack, command, "redo");
    this.redoStack.pop();
    this.undoStack.push(command);
  }

  public clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private assertTop(stack: Command[], command: Command, name: string): void {
    if (stack[stack.length - 1] !== command) {
      throw new HistoryError(`${name} history changed unexpectedly`);
    }
  }
}
