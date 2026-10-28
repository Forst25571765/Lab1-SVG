import { describe, expect, it } from "vitest";

import { CommandExecutor, CommandHistory, HistoryError } from "../src/application/index.js";
import {
  CreateCommand,
  DeleteCommand,
  MoveCommand,
  ScaleCommand,
  SetCommand,
} from "../src/commands/index.js";
import { Document, Group, Rect, Text } from "../src/domain/index.js";

function createExecutor(): CommandExecutor {
  return new CommandExecutor(new CommandHistory());
}

describe("editing commands", () => {
  it("creates a shape and supports undo and redo", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 10, 20, 30, 40);

    executor.execute(new CreateCommand(document, rect));
    expect(document.findById("r1")).toBe(rect);
    expect(executor.history.undoCount).toBe(1);

    executor.undo();
    expect(document.findById("r1")).toBeUndefined();
    expect(executor.history.redoCount).toBe(1);

    executor.redo();
    expect(document.findById("r1")).toBe(rect);
  });

  it("creates a shape in a group and restores its original position", () => {
    const document = new Document();
    const executor = createExecutor();
    const group = new Group("g1");
    const first = new Rect("first", 0, 0, 1, 1);

    document.add(group);
    document.add(first, "g1");

    const second = new Text("second", 10, 10, "second");
    executor.execute(new CreateCommand(document, second, "g1"));
    expect(group.children).toEqual([first, second]);

    executor.undo();
    expect(group.children).toEqual([first]);

    executor.redo();
    expect(group.children).toEqual([first, second]);
  });

  it("deletes and restores a complete subtree at its original position", () => {
    const document = new Document();
    const executor = createExecutor();
    const group = new Group("g1");
    const first = new Rect("first", 0, 0, 1, 1);
    const second = new Text("second", 10, 10, "second");

    document.add(group);
    document.add(first, "g1");
    document.add(second, "g1");

    executor.execute(new DeleteCommand(document, "g1"));
    expect(document.size).toBe(0);

    executor.undo();
    expect(document.children).toEqual([group]);
    expect(group.children).toEqual([first, second]);

    executor.redo();
    expect(document.findById("g1")).toBeUndefined();
  });

  it("moves a shape and restores its previous position", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 10, 20, 30, 40);

    document.add(rect);
    executor.execute(new MoveCommand(document, "r1", 5, -2));
    expect([rect.x, rect.y]).toEqual([15, 18]);

    executor.undo();
    expect([rect.x, rect.y]).toEqual([10, 20]);

    executor.redo();
    expect([rect.x, rect.y]).toEqual([15, 18]);
  });

  it("scales a group and restores every descendant geometry", () => {
    const document = new Document();
    const executor = createExecutor();
    const group = new Group("g1");
    const rect = new Rect("r1", 10, 20, 30, 40);
    const text = new Text("t1", 15, 25, "node");

    document.add(group);
    document.add(rect, "g1");
    document.add(text, "g1");

    executor.execute(new ScaleCommand(document, "g1", 2));
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([20, 40, 60, 80]);
    expect([text.x, text.y]).toEqual([30, 50]);

    executor.undo();
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([10, 20, 30, 40]);
    expect([text.x, text.y]).toEqual([15, 25]);
  });

  it("sets an attribute and restores both old values and absent values", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 10, 10);

    document.add(rect);
    executor.execute(new SetCommand(document, "r1", "x", 5));
    expect(rect.x).toBe(5);
    executor.undo();
    expect(rect.x).toBe(0);

    executor.execute(new SetCommand(document, "r1", "fill", "#fff"));
    expect(rect.fill).toBe("#fff");
    executor.undo();
    expect(rect.fill).toBeUndefined();
    expect(rect.getAttributes()).not.toHaveProperty("fill");
  });

  it("does not record a command that fails before changing the document", () => {
    const document = new Document();
    const executor = createExecutor();

    expect(() => executor.execute(new MoveCommand(document, "missing", 1, 1))).toThrow(
      "no such shape: missing",
    );
    expect(executor.history.undoCount).toBe(0);
    expect(executor.history.redoCount).toBe(0);
    expect(document.size).toBe(0);
  });
});

describe("command history", () => {
  it("undoes only the most recent edit", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 10, 10);

    executor.execute(new CreateCommand(document, rect));
    executor.execute(new MoveCommand(document, "r1", 10, 20));

    executor.undo();
    expect([rect.x, rect.y]).toEqual([0, 0]);
    expect(document.findById("r1")).toBe(rect);
    expect(executor.history.undoCount).toBe(1);
    expect(executor.history.redoCount).toBe(1);
  });

  it("redoes an undone edit", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 10, 10);

    executor.execute(new CreateCommand(document, rect));
    executor.execute(new MoveCommand(document, "r1", 10, 20));
    executor.undo();
    executor.redo();

    expect([rect.x, rect.y]).toEqual([10, 20]);
  });

  it("clears redo after a new edit follows undo", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 10, 10);

    executor.execute(new CreateCommand(document, rect));
    executor.execute(new MoveCommand(document, "r1", 10, 20));
    executor.undo();
    executor.execute(new MoveCommand(document, "r1", 0, 5));

    expect([rect.x, rect.y]).toEqual([0, 5]);
    expect(executor.history.redoCount).toBe(0);
    expect(() => executor.redo()).toThrow("nothing to redo");
  });

  it("reports empty undo and redo stacks", () => {
    const executor = createExecutor();

    expect(() => executor.undo()).toThrow(HistoryError);
    expect(() => executor.redo()).toThrow(HistoryError);
  });

  it("undoes multiple edits in reverse order", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 10, 10);

    executor.execute(new CreateCommand(document, rect));
    executor.execute(new MoveCommand(document, "r1", 1, 2));
    executor.execute(new SetCommand(document, "r1", "fill", "red"));

    executor.undo();
    expect(rect.fill).toBeUndefined();
    executor.undo();
    expect([rect.x, rect.y]).toEqual([0, 0]);
    executor.undo();
    expect(document.findById("r1")).toBeUndefined();
  });
});
