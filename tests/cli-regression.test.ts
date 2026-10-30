import { describe, expect, it } from "vitest";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { SvgCli } from "../src/cli/SvgCli.js";
import { SvgReader, SvgWriter } from "../src/infrastructure/index.js";
import { MemoryFileSystem } from "./helpers/MemoryFileSystem.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

function setup() {
  const files = new MemoryFileSystem();
  const session = new DocumentSession(files, new SvgReader(), new SvgWriter());
  const cli = new SvgCli(session);
  return { files, session, run: (line: string) => cli.run(line) };
}

describe("CLI acceptance regression matrix", () => {
  it.each(["a", "c"])("treats addto within the current parent as one edit, including a no-op: %s", (target) => {
    const { run, session } = setup();
    run("init"); run("create g scene");
    for (const id of ["a", "b", "c"]) run(`create rect ${id} 1 2 3 4 in scene`);
    run("set c fill red"); run("undo");
    const document = session.requireDocument(), before = captureDocument(document);
    const count = session.executor.history.undoCount;
    expect(run(`addto scene ${target}`)).toEqual([`rect#${target} moved into g#scene`]);
    expect(document.requireContainer("scene").children.map((shape) => shape.id))
      .toEqual(target === "a" ? ["b", "c", "a"] : ["a", "b", "c"]);
    expect(session.executor.history.undoCount).toBe(count + 1);
    expect(run("redo")).toEqual(["error: nothing to redo"]);
    const after = captureDocument(document);
    run("undo");
    expectDocumentUnchanged(document, before);
    run("redo");
    expectDocumentUnchanged(document, after);
  });

  it.each([
    "create g a", "delete a", "scale a 2", "set a fill red", "group pair a b", "ungroup a",
    "addto a b", "front a", "back a", "canvas 400 200",
  ])("requires a document for the remaining command routes: %s", (line) => {
    const { session, files, run } = setup();
    expect(run(line)).toEqual(["error: no document. use 'init' or 'read' first"]);
    expect(session.currentDocument).toBeNull();
    expect(session.sourcePath).toBeNull();
    expect([session.executor.history.undoCount, session.executor.history.redoCount]).toEqual([0, 0]);
    expect(files.files.size).toBe(0);
  });

  it.each([
    ["delete missing", "no such shape: missing"], ["scale missing 2", "no such shape: missing"],
    ["set missing x 1", "no such shape: missing"], ["group pair r missing", "no such shape: missing"],
    ["ungroup missing", "no such shape: missing"], ["addto scene missing", "no such shape: missing"],
    ["addto missing r", "no such shape: missing"], ["front missing", "no such shape: missing"],
    ["back missing", "no such shape: missing"], ["tree missing", "no such shape: missing"],
    ["show missing", "no such shape: missing"], ["ungroup r", "not a container: r"],
    ["addto r scene", "not a container: r"], ["group pair r r", "id already exists: r"],
    ["addto scene scene", "cannot move a container into its own descendant: scene"],
    ["addto nested scene", "cannot move a container into its own descendant: scene"],
  ])("preserves both stacks, path and object identity on failure: %s", (line, message) => {
    const { files, session, run } = setup();
    files.files.set("source.svg", '<svg width="400" height="200"><g id="scene"><g id="nested"/>'
      + '<rect id="r" x="1" y="2" width="3" height="4"/></g></svg>');
    expect(run("read source.svg")).toEqual(["read source.svg (3 elements)"]);
    run("move r 2 3"); run("set r fill red"); run("undo");
    const document = session.requireDocument(), before = captureDocument(document);
    const history = session.executor.history;
    const undo = history.peekUndo(), redo = history.peekRedo();
    expect(run(line)).toEqual([`error: ${message}`]);
    expect(session.currentDocument).toBe(document);
    expect(session.sourcePath).toBe("source.svg");
    expectDocumentUnchanged(document, before);
    expect([history.undoCount, history.redoCount]).toEqual([1, 1]);
    expect(history.peekUndo()).toBe(undo);
    expect(history.peekRedo()).toBe(redo);
    expect(run("redo")).toEqual(["rect#r updated: fill=red"]);
  });

  it("recovers every CLI edit in both directions, branches history and round-trips the final document in memory", () => {
    const { run, session, files } = setup();
    run("init 640 480");
    const document = session.requireDocument();
    const lines = [
      "create g scene", "create g left in scene", "create g right in scene",
      "create rect r 1 2 30 40 #123abc in left", 'create text t 5 6 "原文 # in" in left',
      "create circle c 10 20 3 in right", "create ellipse e 30 40 5 6 in right",
      "create line l 0 0 40 50 black in scene", "set scene stroke-width 2",
      "set r width 60", 'set t text "更新 & <内容> 😀"', "move left 0.1 -0.2", "scale scene 1.25",
      "group pair e c", "ungroup pair", "addto right r", "front right", "back right",
      "delete left", "create g empty in scene", "ungroup empty",
    ];
    const states = [captureDocument(document)];
    for (const line of lines) {
      expect(run(line)[0], line).not.toMatch(/^error:/);
      states.push(captureDocument(document));
    }
    expect(session.executor.history.undoCount).toBe(lines.length);
    for (let round = 0; round < 2; round++) {
      for (let index = lines.length - 1; index >= 0; index--) {
        expect(run("undo")[0]).not.toMatch(/^error:/);
        expectDocumentUnchanged(document, states[index]);
      }
      expect(run("undo")).toEqual(["error: nothing to undo"]);
      for (let index = 1; index <= lines.length; index++) {
        expect(run("redo")[0]).not.toMatch(/^error:/);
        expectDocumentUnchanged(document, states[index]);
      }
      expect(run("redo")).toEqual(["error: nothing to redo"]);
    }
    run("undo");
    expect(run("set scene fill blue")).toEqual(["g#scene updated: fill=blue"]);
    expect(run("redo")).toEqual(["error: nothing to redo"]);
    const expectedTree = run("tree"), expected = captureDocument(document);
    expect(run('save "final drawing.svg"')[0]).toMatch(/^saved to/);
    expect(files.files.size).toBe(1);
    expect(run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(run('read "final drawing.svg"')[0]).toMatch(/^read final drawing.svg/);
    expect(run("tree")).toEqual(expectedTree);
    expect(captureDocument(session.requireDocument()).values).toEqual(expected.values);
    expect(session.requireDocument()).not.toBe(document);
    expectDocumentUnchanged(document, expected);
  });

  it("keeps imported carriage returns intact through CLI save/read and shows them on one line", () => {
    const { run, files } = setup();
    files.files.set("text.svg", '<svg width="10" height="10"><text id="t" x="0" y="0">A&#13;\nB</text></svg>');
    run("read text.svg");
    const shown = run("show t");
    expect(shown).toContain('  text="A\\r\\nB"');
    run("save"); run("read text.svg");
    expect(run("show t")).toEqual(shown);
  });
});
