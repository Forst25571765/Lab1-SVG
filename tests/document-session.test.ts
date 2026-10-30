import { describe, expect, it } from "vitest";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { CreateCommand, MoveCommand } from "../src/commands/index.js";
import { Rect, Text } from "../src/domain/index.js";
import { SvgReader } from "../src/infrastructure/SvgReader.js";
import { SvgWriter } from "../src/infrastructure/SvgWriter.js";
import { MemoryFileSystem } from "./helpers/MemoryFileSystem.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

const source = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><g id="scene"/></svg>';

function setup() {
  const files = new MemoryFileSystem();
  const session = new DocumentSession(files, new SvgReader(), new SvgWriter());
  files.files.set("a.svg", source);
  files.files.set("b.svg", source.replace('id="scene"', 'id="other"'));
  return { files, session, executor: session.executor };
}

function createBothStacks(session: DocumentSession) {
  const document = session.requireDocument();
  const executor = session.executor;
  executor.execute(new CreateCommand(document, new Rect("r1", 10, 20, 30, 40)));
  executor.execute(new MoveCommand(document, "r1", 5, 0));
  executor.undo();
  return { undo: executor.history.peekUndo(), redo: executor.history.peekRedo() };
}

function expectBlocked(session: DocumentSession) {
  expect(session.executor.history.undoCount).toBe(0);
  expect(session.executor.history.redoCount).toBe(0);
  expect(() => session.executor.undo()).toThrow("undo not allowed after io command");
  expect(() => session.executor.redo()).toThrow("undo not allowed after io command");
}

describe("document session", () => {
  it("requires a current document for save and canvas", () => {
    const { session } = setup();
    expect(session.currentDocument).toBeNull();
    expect(() => session.save("out.svg")).toThrow("no document. use 'init' or 'read' first");
    expect(() => session.canvas()).toThrow("no document. use 'init' or 'read' first");
    expect(() => session.canvas(1, 2)).toThrow("no document. use 'init' or 'read' first");
  });

  it("initializes default or explicit dimensions and clears the previous read path", () => {
    const { session } = setup();
    session.read("a.svg");
    const document = session.init();
    expect([document.width, document.height, document.size]).toEqual([800, 600, 0]);
    expect(session.sourcePath).toBeNull();
    expect(() => session.save()).toThrow("no save path. specify a file path");
    expectBlocked(session);
    const replacement = session.init(300, 150);
    expect([replacement.width, replacement.height]).toEqual([300, 150]);
    expect(session.currentDocument).toBe(replacement);
  });

  it("returns read warnings and element counts only after accepting the new document", () => {
    const { files, session } = setup();
    files.files.set("unnamed.svg", source.replace('id="scene"', ""));
    const result = session.read("unnamed.svg");
    expect(result).toMatchObject({ path: "unnamed.svg", elementCount: 1, warnings: [
      "warning: assigned id g1 to unnamed <g>",
    ] });
    expect(session.currentDocument).toBe(result.document);
    expect(session.sourcePath).toBe("unnamed.svg");
    expectBlocked(session);
  });

  it("writes to an explicit path or the read path; save-as does not change the read path", () => {
    const { files, session } = setup();
    session.init();
    session.save("new.svg");
    expect(session.sourcePath).toBeNull();
    expect(() => session.save()).toThrow("no save path. specify a file path");
    session.read("a.svg");
    const before = captureDocument(session.requireDocument());
    expect(session.save("copy.svg")).toEqual({ path: "copy.svg", elementCount: 1 });
    expect(session.sourcePath).toBe("a.svg");
    expect(session.save()).toEqual({ path: "a.svg", elementCount: 1 });
    expect(files.files.get("copy.svg")).toBe(files.files.get("a.svg"));
    expectDocumentUnchanged(session.requireDocument(), before);
  });

  it.each(["missing file", "invalid XML", "duplicate ID"])(
    "preserves the current document, path and both stack tops when read fails: %s",
    (scenario) => {
      const { files, session, executor } = setup();
      session.read("a.svg");
      const tops = createBothStacks(session);
      const document = session.requireDocument();
      const before = captureDocument(document);
      if (scenario === "invalid XML") files.files.set("bad.svg", "<svg><g></svg>");
      if (scenario === "duplicate ID") {
        files.files.set("bad.svg", source.replace('<g id="scene"/>', '<g id="same"/><g id="same"/>'));
      }
      expect(() => session.read("bad.svg")).toThrow(
        scenario === "missing file" ? "cannot read file: bad.svg" : undefined,
      );
      expect(session.currentDocument).toBe(document);
      expect(session.sourcePath).toBe("a.svg");
      expectDocumentUnchanged(document, before);
      expect(executor.history.peekUndo()).toBe(tops.undo);
      expect(executor.history.peekRedo()).toBe(tops.redo);
      executor.redo();
      expect(document.requireShape("r1").getAttribute("x")).toBe(15);
    },
  );

  it("preserves memory, the old file and both stacks when writing fails", () => {
    const { files, session, executor } = setup();
    session.read("a.svg");
    const tops = createBothStacks(session);
    const document = session.requireDocument();
    const before = captureDocument(document);
    files.unwritable.add("a.svg");
    expect(() => session.save()).toThrow("cannot write file: a.svg");
    expect(files.files.get("a.svg")).toBe(source);
    expect(session.currentDocument).toBe(document);
    expect(session.sourcePath).toBe("a.svg");
    expectDocumentUnchanged(document, before);
    expect(executor.history.peekUndo()).toBe(tops.undo);
    expect(executor.history.peekRedo()).toBe(tops.redo);
  });

  it("does not write or change history when text cannot be serialized as valid XML", () => {
    const { files, session, executor } = setup();
    session.read("a.svg");
    executor.execute(new CreateCommand(session.requireDocument(), new Text("bad", 0, 0, "bad\u0000text")));
    const top = executor.history.peekUndo();
    expect(() => session.save()).toThrow();
    expect(files.files.get("a.svg")).toBe(source);
    expect(session.sourcePath).toBe("a.svg");
    expect(executor.history.peekUndo()).toBe(top);
  });

  it.each(["init", "read", "save", "canvas", "unchanged canvas"])(
    "starts an uncrossable history boundary only after successful %s",
    (operation) => {
      const { session, executor } = setup();
      session.read("a.svg");
      const oldDocument = session.requireDocument();
      createBothStacks(session);
      if (operation === "init") session.init();
      if (operation === "read") session.read("b.svg");
      if (operation === "save") session.save();
      if (operation === "canvas") session.canvas(1024, 768);
      if (operation === "unchanged canvas") session.canvas(400, 200);
      expectBlocked(session);
      session.canvas();
      expectBlocked(session);
      const current = session.requireDocument();
      executor.execute(new CreateCommand(current, new Rect("fresh", 1, 2, 3, 4)));
      executor.undo();
      expect(current.findById("fresh")).toBeUndefined();
      expect(() => executor.undo()).toThrow("nothing to undo");
      executor.redo();
      expect(current.findById("fresh")).toBeDefined();
      expect(oldDocument.findById("r1")).toBeDefined();
    },
  );

  it("preserves query history and rejects invalid init/canvas without partial changes", () => {
    const { session, executor } = setup();
    session.read("a.svg");
    const tops = createBothStacks(session);
    const document = session.requireDocument();
    const before = captureDocument(document);
    expect(session.canvas()).toEqual({ width: 400, height: 200 });
    expect(() => session.canvas(1024, Number.NaN)).toThrow("invalid number for height");
    expect(() => session.init(1024, Number.NaN)).toThrow("invalid number for height");
    expect(session.currentDocument).toBe(document);
    expect(session.sourcePath).toBe("a.svg");
    expectDocumentUnchanged(document, before);
    expect(executor.history.peekUndo()).toBe(tops.undo);
    expect(executor.history.peekRedo()).toBe(tops.redo);
  });

  it("keeps an existing boundary blocked after file failure or failed edit", () => {
    const { files, session, executor } = setup();
    session.read("a.svg");
    files.unwritable.add("a.svg");
    expect(() => session.read("missing.svg")).toThrow("cannot read file: missing.svg");
    expect(() => session.save()).toThrow("cannot write file: a.svg");
    expect(() => executor.execute(new MoveCommand(session.requireDocument(), "missing", 1, 2)))
      .toThrow("no such shape: missing");
    expectBlocked(session);
  });
});
