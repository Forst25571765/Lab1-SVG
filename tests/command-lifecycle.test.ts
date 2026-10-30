import { describe, expect, it } from "vitest";
import { CommandExecutor } from "../src/application/CommandExecutor.js";
import {
  AddToCommand, BackCommand, CreateCommand, DeleteCommand, FrontCommand, GroupCommand,
  MoveCommand, ScaleCommand, SetCommand, UngroupCommand, type Command,
} from "../src/commands/index.js";
import { Document, Group, Rect } from "../src/domain/index.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

function setup() {
  const document = new Document();
  document.add(new Group("scene"));
  document.add(new Rect("a", 1.1, 2.2, 3.3, 4.4), "scene");
  document.add(new Group("nested"), "scene");
  document.add(new Rect("b", 5, 6, 7, 8), "nested");
  document.add(new Rect("c", 9, 10, 11, 12), "scene");
  return document;
}

const commands: [string, (document: Document) => Command][] = [
  ["create", (document) => new CreateCommand(document, new Rect("new", 1, 2, 3, 4), "nested")],
  ["delete", (document) => new DeleteCommand(document, "nested")],
  ["move", (document) => new MoveCommand(document, "scene", 0.1, -0.2)],
  ["scale", (document) => new ScaleCommand(document, "scene", 1.3)],
  ["set", (document) => new SetCommand(document, "scene", "fill", "red")],
  ["group", (document) => new GroupCommand(document, "pair", ["c", "a"])],
  ["ungroup", (document) => new UngroupCommand(document, "nested")],
  ["addto", (document) => new AddToCommand(document, "nested", "a")],
  ["front", (document) => new FrontCommand(document, "a")],
  ["back", (document) => new BackCommand(document, "c")],
];

describe("command lifecycle and recoverable history failures", () => {
  it.each(commands)("protects %s from duplicate execution/undo and restores exact snapshots", (_name, make) => {
    const document = setup(), command = make(document);
    const executor = new CommandExecutor();
    const before = captureDocument(document);
    expect(() => command.undo()).toThrow("command has not been executed");
    expectDocumentUnchanged(document, before);
    executor.execute(command);
    const after = captureDocument(document);
    expect(() => executor.execute(command)).toThrow("command is already executed");
    expect(executor.history.undoCount).toBe(1);
    expectDocumentUnchanged(document, after);
    for (let round = 0; round < 3; round++) {
      executor.undo();
      expectDocumentUnchanged(document, before);
      expect(() => command.undo()).toThrow("command has not been executed");
      expect(executor.history.peekRedo()).toBe(command);
      executor.redo();
      expectDocumentUnchanged(document, after);
      expect(executor.history.peekUndo()).toBe(command);
    }
  });

  it("retains a failed undo for retry when a deleted id is occupied", () => {
    const document = setup(), executor = new CommandExecutor();
    const original = document.requireShape("a");
    const command = new DeleteCommand(document, "a");
    executor.execute(command);
    const conflict = new Rect("a", 100, 100, 1, 1);
    document.add(conflict);
    const before = captureDocument(document);
    expect(() => executor.undo()).toThrow("id already exists: a");
    expectDocumentUnchanged(document, before);
    expect(executor.history.peekUndo()).toBe(command);
    expect(executor.history.redoCount).toBe(0);
    document.remove(conflict);
    executor.undo();
    expect(document.requireShape("a")).toBe(original);
    expect(original.parent?.id).toBe("scene");
    executor.redo();
    expect(document.findById("a")).toBeUndefined();
  });

  it("retains a failed redo for retry when a created id is occupied", () => {
    const document = setup(), executor = new CommandExecutor();
    const original = new Rect("new", 1, 2, 3, 4);
    const command = new CreateCommand(document, original, "scene");
    executor.execute(command);
    executor.undo();
    const conflict = new Rect("new", 100, 100, 1, 1);
    document.add(conflict);
    const before = captureDocument(document);
    expect(() => executor.redo()).toThrow("id already exists: new");
    expectDocumentUnchanged(document, before);
    expect(executor.history.peekRedo()).toBe(command);
    expect(executor.history.undoCount).toBe(0);
    document.remove(conflict);
    executor.redo();
    expect(document.requireShape("new")).toBe(original);
    executor.undo();
    expect(document.findById("new")).toBeUndefined();
  });
});
