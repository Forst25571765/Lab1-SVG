import { describe, expect, it } from "vitest";

import { CommandExecutor, HistoryError } from "../src/application/index.js";
import { CreateCommand, MoveCommand, ScaleCommand } from "../src/commands/index.js";
import { Circle, Document, DomainError, Ellipse, Group, Line, Rect, Shape, Text } from "../src/domain/index.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

const leaves = [
  { name: "rect", create: () => new Rect("target", 10, 20, 30, 40), positions: ["x", "y"], geometry: ["x", "y", "width", "height"] },
  { name: "circle", create: () => new Circle("target", 10, 20, 30), positions: ["cx", "cy"], geometry: ["cx", "cy", "r"] },
  { name: "ellipse", create: () => new Ellipse("target", 10, 20, 30, 40), positions: ["cx", "cy"], geometry: ["cx", "cy", "rx", "ry"] },
  { name: "line", create: () => new Line("target", 10, 20, 30, 40), positions: ["x1", "y1", "x2", "y2"], geometry: ["x1", "y1", "x2", "y2"] },
  { name: "text", create: () => new Text("target", 10, 20, "中文 & text"), positions: ["x", "y"], geometry: ["x", "y"] },
];

function nestedGroup(): Group {
  const group = new Group("target", { fill: "red" });
  const nested = new Group("nested");
  group.addChild(new Rect("first", 1, 2, 3, 4));
  nested.addChild(new Text("last", 5, 6, "last"));
  group.addChild(nested);
  return group;
}

const shapes: { name: string; create: () => Shape }[] = [
  ...leaves,
  { name: "empty group", create: () => new Group("target") },
  { name: "nested group", create: nestedGroup },
];

describe.each(shapes)("invalid geometry inputs: $name", ({ create }) => {
  it.each([
    [Number.NaN, 5, "dx"],
    [Number.POSITIVE_INFINITY, 5, "dx"],
    [Number.NEGATIVE_INFINITY, 5, "dx"],
    [5, Number.NaN, "dy"],
    [5, Number.POSITIVE_INFINITY, "dy"],
    [5, Number.NEGATIVE_INFINITY, "dy"],
  ] as const)("rejects move(%s, %s) without partial changes", (dx, dy, label) => {
    const document = new Document();
    const shape = create();
    document.add(shape);
    const before = captureDocument(document);

    expect(() => shape.move(dx, dy)).toThrow(new DomainError("invalid-number", `invalid number for ${label}`));

    expectDocumentUnchanged(document, before);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects scale(%s) without changing state", (factor) => {
      const document = new Document();
      const shape = create();
      document.add(shape);
      const before = captureDocument(document);
      const message = Number.isFinite(factor)
        ? "scale factor must be positive" : "invalid number for scale factor";

      expect(() => shape.scale(factor)).toThrow(message);

      expectDocumentUnchanged(document, before);
    },
  );
});

describe("finite inputs whose results overflow", () => {
  it.each(leaves.flatMap((leaf) => leaf.positions.map((attribute) => ({ ...leaf, attribute }))))(
    "rejects move overflow in $name.$attribute before changing any geometry", ({ create, attribute }) => {
      const document = new Document();
      const shape = create();
      shape.setAttribute(attribute, Number.MAX_VALUE);
      document.add(shape);
      const before = captureDocument(document);

      expect(() => shape.move(Number.MAX_VALUE, Number.MAX_VALUE)).toThrow(`invalid number for ${attribute}`);

      expectDocumentUnchanged(document, before);
    },
  );

  it.each(leaves.flatMap((leaf) => leaf.geometry.map((attribute) => ({ ...leaf, attribute }))))(
    "rejects scale overflow in $name.$attribute before changing any geometry", ({ create, attribute }) => {
      const document = new Document();
      const shape = create();
      shape.setAttribute(attribute, Number.MAX_VALUE);
      document.add(shape);
      const before = captureDocument(document);

      expect(() => shape.scale(2)).toThrow(`invalid number for ${attribute}`);

      expectDocumentUnchanged(document, before);
    },
  );

  it.each(["move", "scale"] as const)("rejects negative overflow during %s", (operation) => {
    const rect = new Rect("r1", -Number.MAX_VALUE, 20, 30, 40);
    const before = rect.getAttributes();

    expect(() => operation === "move" ? rect.move(-Number.MAX_VALUE, 1) : rect.scale(2)).toThrow(
      "invalid number for x",
    );
    expect(rect.getAttributes()).toEqual(before);
  });

  it("continues accepting large finite results and ordinary fractional coordinates", () => {
    const rect = new Rect("r1", 1e308, -0.5, 20, 40, { strokeWidth: 3 });
    rect.scale(0.5);
    rect.move(0, 0.125);
    expect(rect.getAttributes()).toEqual({ x: 5e307, y: -0.125, width: 10, height: 20, "stroke-width": 3 });
  });
});

describe("whole-subtree and command atomicity", () => {
  it.each(["move", "scale"] as const)("preserves earlier siblings when a late descendant overflows during %s", (operation) => {
    const document = new Document();
    const group = nestedGroup();
    document.add(group);
    document.requireShape("last").setAttribute("y", Number.MAX_VALUE);
    const before = captureDocument(document);

    expect(() => operation === "move" ? group.move(1, Number.MAX_VALUE) : group.scale(2)).toThrow(
      "invalid number for y",
    );

    expectDocumentUnchanged(document, before);
  });

  it.each(["invalid move", "overflow move", "overflow scale"] as const)(
    "preserves existing undo/redo after %s fails", (scenario) => {
      const document = new Document();
      const executor = new CommandExecutor();
      const group = nestedGroup();
      executor.execute(new CreateCommand(document, group));
      document.requireShape("last").setAttribute("y", Number.MAX_VALUE);
      executor.execute(new MoveCommand(document, "target", 2, 0));
      const afterMove = captureDocument(document);
      executor.undo();
      const before = captureDocument(document);
      const undoTop = executor.history.peekUndo();
      const redoTop = executor.history.peekRedo();
      const command = scenario === "overflow scale" ? new ScaleCommand(document, "target", 2)
        : new MoveCommand(document, scenario === "invalid move" ? "first" : "target", 5,
          scenario === "invalid move" ? Number.NaN : Number.MAX_VALUE);

      expect(() => executor.execute(command)).toThrow(DomainError);
      expectDocumentUnchanged(document, before);
      expect(executor.history.undoCount).toBe(1);
      expect(executor.history.redoCount).toBe(1);
      expect(executor.history.peekUndo()).toBe(undoTop);
      expect(executor.history.peekRedo()).toBe(redoTop);
      expect(() => command.undo()).toThrow("command has not been executed");

      executor.redo();
      expectDocumentUnchanged(document, afterMove);
      executor.undo();
      expectDocumentUnchanged(document, before);
    },
  );

  it("rejects overflow without poisoning later edit snapshots and undo", () => {
    const document = new Document();
    const executor = new CommandExecutor();
    const rect = new Rect("r1", 1e308, 20, 30, 40);
    document.add(rect);
    const before = captureDocument(document);
    const command = new ScaleCommand(document, "r1", 2);

    expect(() => executor.execute(command)).toThrow("invalid number for x");
    expectDocumentUnchanged(document, before);
    expect(executor.history.undoCount).toBe(0);
    executor.execute(new MoveCommand(document, "r1", 1, 1));
    executor.undo();
    expectDocumentUnchanged(document, before);

    rect.setAttribute("x", 10);
    executor.execute(command);
    expect(rect.x).toBe(20);
    executor.undo();
    expect(rect.x).toBe(10);
  });

  it("preserves the document boundary after an invalid move", () => {
    const document = new Document();
    const executor = new CommandExecutor();
    document.add(new Rect("r1", 10, 20, 30, 40));
    executor.executeDocument(() => document.setCanvasSize(400, 200));
    const before = captureDocument(document);

    expect(() => executor.execute(new MoveCommand(document, "r1", 5, Number.NaN))).toThrow("invalid number for dy");
    expectDocumentUnchanged(document, before);
    expect(() => executor.undo()).toThrow(new HistoryError("undo not allowed after io command"));
    expect(() => executor.redo()).toThrow(new HistoryError("undo not allowed after io command"));
  });

  it("restores exact snapshots through repeated fractional move/scale undo and redo", () => {
    const document = new Document();
    const executor = new CommandExecutor();
    document.add(nestedGroup());
    const initial = captureDocument(document);
    executor.execute(new MoveCommand(document, "target", 0.1, -0.2));
    executor.execute(new ScaleCommand(document, "target", 0.3));
    const edited = captureDocument(document);

    for (let iteration = 0; iteration < 10; iteration++) {
      executor.undo();
      executor.undo();
      expectDocumentUnchanged(document, initial);
      executor.redo();
      executor.redo();
      expectDocumentUnchanged(document, edited);
    }
  });
});
