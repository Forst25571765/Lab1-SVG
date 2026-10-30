import { describe, expect, it } from "vitest";

import { CommandExecutor, HistoryError } from "../src/application/index.js";
import { CreateCommand, MoveCommand } from "../src/commands/index.js";
import { Document, Rect } from "../src/domain/index.js";

function createSession() {
  const document = new Document();
  const executor = new CommandExecutor();
  const rect = new Rect("r1", 10, 20, 30, 40);
  executor.execute(new CreateCommand(document, rect));
  return { document, executor, rect };
}

function expectHistoryBlocked(executor: CommandExecutor): void {
  expect(executor.history.canUndo).toBe(false);
  expect(executor.history.canRedo).toBe(false);
  expect(() => executor.undo()).toThrow(new HistoryError("undo not allowed after io command"));
  expect(() => executor.redo()).toThrow(new HistoryError("undo not allowed after io command"));
}

describe("document and query history policy", () => {
  it("preserves both history stacks when querying canvas dimensions", () => {
    const { document, executor, rect } = createSession();
    executor.execute(new MoveCommand(document, "r1", 5, 0));
    executor.undo();
    const oldUndo = executor.history.peekUndo();
    const oldRedo = executor.history.peekRedo();

    expect(executor.executeQuery(() => [document.width, document.height])).toEqual([800, 600]);
    expect(executor.history.undoCount).toBe(1);
    expect(executor.history.redoCount).toBe(1);
    expect(executor.history.peekUndo()).toBe(oldUndo);
    expect(executor.history.peekRedo()).toBe(oldRedo);

    executor.redo();
    expect(rect.x).toBe(15);
    executor.executeQuery(() => [document.width, document.height]);
    executor.undo();
    expect(rect.x).toBe(10);
  });

  it.each(["resize", "unchanged size"] as const)(
    "clears both stacks and blocks history after a successful canvas update: %s",
    (scenario) => {
      const { document, executor, rect } = createSession();
      executor.execute(new MoveCommand(document, "r1", 5, 0));
      executor.undo();
      const dimensions = scenario === "resize" ? [1024, 768] as const : [800, 600] as const;

      executor.executeDocument(() => document.setCanvasSize(dimensions[0], dimensions[1]));

      expect([document.width, document.height]).toEqual(dimensions);
      expect(rect.x).toBe(10);
      expect(executor.history.undoCount).toBe(0);
      expect(executor.history.redoCount).toBe(0);
      expectHistoryBlocked(executor);
    },
  );

  it("does not lift a document boundary when querying or when an edit fails", () => {
    const { document, executor, rect } = createSession();
    executor.executeDocument(() => document.setCanvasSize(1024, 768));

    expect(executor.executeQuery(() => [document.width, document.height])).toEqual([1024, 768]);
    expectHistoryBlocked(executor);
    expect(() => executor.execute(new MoveCommand(document, "missing", 5, 0))).toThrow(
      "no such shape: missing",
    );
    expectHistoryBlocked(executor);
    expect(() => executor.executeQuery(() => document.requireShape("missing"))).toThrow(
      "no such shape: missing",
    );
    expectHistoryBlocked(executor);
    expect(executor.history.undoCount).toBe(0);
    expect(executor.history.redoCount).toBe(0);
    expect(rect.x).toBe(10);
  });

  it("starts fresh history after a successful edit and cannot undo across the boundary", () => {
    const { document, executor, rect } = createSession();
    executor.executeDocument(() => document.setCanvasSize(1024, 768));

    executor.execute(new MoveCommand(document, "r1", 5, 0));
    expect(rect.x).toBe(15);
    expect(executor.history.canUndo).toBe(true);
    expect(executor.history.undoCount).toBe(1);
    executor.undo();
    expect(rect.x).toBe(10);
    expect([document.width, document.height]).toEqual([1024, 768]);
    expect(document.findById("r1")).toBe(rect);
    expect(() => executor.undo()).toThrow(new HistoryError("nothing to undo"));
    executor.redo();
    expect(rect.x).toBe(15);
  });

  it.each([
    [Number.NaN, 768, "invalid number for width"],
    [1024, Number.NaN, "invalid number for height"],
    [Number.POSITIVE_INFINITY, 768, "invalid number for width"],
    [1024, Number.NEGATIVE_INFINITY, "invalid number for height"],
  ] as const)("preserves canvas and both stacks when resizing fails (%s, %s)", (width, height, message) => {
    const { document, executor, rect } = createSession();
    executor.execute(new MoveCommand(document, "r1", 5, 0));
    executor.undo();
    const oldUndo = executor.history.peekUndo();
    const oldRedo = executor.history.peekRedo();

    expect(() => executor.executeDocument(() => document.setCanvasSize(width, height))).toThrow(message);

    expect([document.width, document.height]).toEqual([800, 600]);
    expect(executor.history.undoCount).toBe(1);
    expect(executor.history.redoCount).toBe(1);
    expect(executor.history.peekUndo()).toBe(oldUndo);
    expect(executor.history.peekRedo()).toBe(oldRedo);
    executor.redo();
    expect(rect.x).toBe(15);
    executor.undo();
    expect(rect.x).toBe(10);
  });

  it("keeps history blocked when another document operation fails", () => {
    const { document, executor } = createSession();
    executor.executeDocument(() => document.setCanvasSize(1024, 768));

    expect(() => executor.executeDocument(() => document.setCanvasSize(400, Number.NaN))).toThrow(
      "invalid number for height",
    );

    expect([document.width, document.height]).toEqual([1024, 768]);
    expectHistoryBlocked(executor);
  });

  it("discards old document commands when the current document is replaced", () => {
    const session = createSession();
    const { executor, rect } = session;
    let currentDocument = session.document;

    executor.executeDocument(() => {
      currentDocument = Document.createEmpty(400, 200);
    });
    expectHistoryBlocked(executor);
    const replacement = new Rect("r1", 1, 2, 3, 4);
    executor.execute(new CreateCommand(currentDocument, replacement));
    executor.undo();

    expect(currentDocument.size).toBe(0);
    expect(session.document.findById("r1")).toBe(rect);
    expect(() => executor.undo()).toThrow(new HistoryError("nothing to undo"));
    executor.redo();
    expect(currentDocument.findById("r1")).toBe(replacement);
  });
});
