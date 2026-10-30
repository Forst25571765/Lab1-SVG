import { describe, expect, it } from "vitest";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { CommandRegistry } from "../src/cli/CommandRegistry.js";
import { SvgCli } from "../src/cli/SvgCli.js";
import { SvgReader, SvgWriter } from "../src/infrastructure/index.js";
import { MemoryFileSystem } from "./helpers/MemoryFileSystem.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

function setup() {
  const files = new MemoryFileSystem();
  const session = new DocumentSession(files, new SvgReader(), new SvgWriter());
  const registry = new CommandRegistry(session);
  const cli = new SvgCli(session, undefined, registry);
  return { files, session, registry, cli, run: (line: string) => cli.run(line) };
}

describe("CLI command integration", () => {
  it("registers all nineteen commands and offers help before initialization", () => {
    const { registry, session, run } = setup();
    const names = ["init", "read", "save", "canvas", "create", "delete", "move", "scale", "set", "group", "ungroup", "addto", "front", "back", "tree", "show", "help", "undo", "redo"];
    expect(registry.names).toEqual(names);
    const help = run("help").join("\n");
    for (const name of names) expect(help).toMatch(new RegExp(`\\b${name}\\b`));
    expect(help).toContain('create text <id> <x> <y> "content"');
    expect(session.currentDocument).toBeNull();
    expect(run(" ")).toEqual([]);
    expect(run(" # comment")).toEqual([]);
  });

  it.each(["tree", "show x", "canvas", "save a.svg", "move x 1 2", "undo", "redo"])(
    "reports the specified no-document error: %s", (line) => {
      expect(setup().run(line)).toEqual(["error: no document. use 'init' or 'read' first"]);
    },
  );

  it("rejects one init dimension before creating a document and shows the paired syntax", () => {
    const { run, session } = setup();
    expect(run("init 400")).toEqual(["error: usage: init [w h]"]);
    expect(session.currentDocument).toBeNull();
    expect(session.sourcePath).toBeNull();
    expect(session.executor.history.undoCount).toBe(0);
    expect(session.executor.history.redoCount).toBe(0);
    expect(run("help")).toContain("  init [w h]");
    expect(run("init")).toEqual(["canvas 800x600 created"]);
    expect(run("init 400 200")).toEqual(["canvas 400x200 created"]);
  });

  it("preserves the document, read path and both history stacks when init has one dimension", () => {
    const { files, session, run } = setup();
    files.files.set("source.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">'
      + '<rect id="r1" x="10" y="20" width="30" height="40"/></svg>');
    run("read source.svg");
    run("move r1 5 0");
    run("move r1 10 0");
    run("undo");
    const document = session.requireDocument(), before = captureDocument(document);
    const history = session.executor.history;
    const undo = history.peekUndo(), redo = history.peekRedo();
    expect(run("init 400")).toEqual(["error: usage: init [w h]"]);
    expect(session.currentDocument).toBe(document);
    expect(session.sourcePath).toBe("source.svg");
    expectDocumentUnchanged(document, before);
    expect([history.undoCount, history.redoCount]).toEqual([1, 1]);
    expect(history.peekUndo()).toBe(undo);
    expect(history.peekRedo()).toBe(redo);
    expect(run("redo")).toEqual(["rect#r1 moved to (25,20)"]);
  });

  it("keeps history blocked and the canvas unchanged after a one-dimension init fails", () => {
    const { run, session } = setup();
    run("init 320 240");
    const document = session.requireDocument(), before = captureDocument(document);
    expect(run("init 400")).toEqual(["error: usage: init [w h]"]);
    expect(session.currentDocument).toBe(document);
    expectDocumentUnchanged(document, before);
    expect(run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(run("redo")).toEqual(["error: undo not allowed after io command"]);
  });

  it("creates all types, handles in suffixes, colors and quoted literal in content", () => {
    const { run, session } = setup();
    expect(run("init")).toEqual(["canvas 800x600 created"]);
    expect(run("create g scene")).toEqual(["g#scene created"]);
    expect(run("create rect r1 10 20 100 50 #4a90d9 in scene")).toEqual(["rect#r1 created in g#scene"]);
    for (const line of ["create circle c1 100 100 20 red", "create ellipse e1 1 2 3 4", "create line l1 1 2 3 4 black", 'create text t1 20 40 "literal in scene #1" in scene']) {
      expect(run(line)[0]).not.toMatch(/^error:/);
    }
    expect(run('create text empty 0 0 ""')).toEqual(["text#empty created"]);
    expect(session.requireDocument().size).toBe(7);
    expect(session.requireDocument().requireShape("t1").getAttribute("text")).toBe("literal in scene #1");
    expect(session.requireDocument().requireShape("t1").parent?.id).toBe("scene");
    expect(session.requireDocument().requireShape("r1").fill).toBe("#4a90d9");
    expect(session.requireDocument().requireShape("e1").fill).toBeUndefined();
  });

  it("executes commented edits without truncating colors, quoted text or the in suffix", () => {
    const { run, session } = setup();
    expect(run("init 400 200 # 新画布")).toEqual(["canvas 400x200 created"]);
    expect(run("create g scene # 容器")).toEqual(["g#scene created"]);
    expect(run('create rect r1 10 20 30 40 #4a90d9 in scene # "ignored'))
      .toEqual(["rect#r1 created in g#scene"]);
    expect(run('create text t1 0 0 "# heading in scene" in scene # in missing'))
      .toEqual(["text#t1 created in g#scene"]);
    const document = session.requireDocument();
    expect(document.requireShape("r1").fill).toBe("#4a90d9");
    expect(document.requireShape("t1").getAttribute("text")).toBe("# heading in scene");
    expect(document.requireContainer("scene").children.map((shape) => shape.id)).toEqual(["r1", "t1"]);
    expect(run("help # usage").join("\n")).toContain("standalone #");
  });

  it("keeps comments and commented queries out of history and executes only the uncommented command", () => {
    const { run, session } = setup();
    run("init");
    expect(run("  #create rect ignored 0 0 1 1")).toEqual([]);
    expect(run("undo # comment only")).toEqual(["error: undo not allowed after io command"]);
    run("create rect r1 10 20 30 40");
    run("move r1 5 0"); run("undo");
    const document = session.requireDocument(), before = captureDocument(document);
    const history = session.executor.history;
    const undo = history.peekUndo(), redo = history.peekRedo();
    for (const line of ["# redo", "canvas # query", "tree # query", "show r1 # query", 'help # "ignored']) {
      expect(run(line).some((message) => message.startsWith("error:"))).toBe(false);
    }
    expectDocumentUnchanged(document, before);
    expect(history.peekUndo()).toBe(undo);
    expect(history.peekRedo()).toBe(redo);
    expect(run("redo # undo")).toEqual(["rect#r1 moved to (15,20)"]);
    expect(document.requireShape("r1").getAttribute("x")).toBe(15);
  });

  it("retains argument and quote errors before comments without changing the document or history", () => {
    const { run, session } = setup();
    run("init"); run("create rect r1 10 20 30 40"); run("move r1 5 0"); run("undo");
    const document = session.requireDocument(), before = captureDocument(document);
    const history = session.executor.history;
    const undo = history.peekUndo(), redo = history.peekRedo();
    expect(run("move r1 1 # missing dy")).toEqual(["error: usage: move <id> <dx> <dy>"]);
    expect(run("init 400 # missing height")).toEqual(["error: usage: init [w h]"]);
    expect(run('create text bad 0 0 "unfinished # still text')).toEqual(["error: unterminated double quote"]);
    expectDocumentUnchanged(document, before);
    expect(session.currentDocument).toBe(document);
    expect(history.peekUndo()).toBe(undo);
    expect(history.peekRedo()).toBe(redo);
  });

  it("reports move, set and their undo/redo using restored values", () => {
    const { run } = setup();
    run("init");
    run("create circle c1 100 100 20 red");
    expect(run("move c1 30 0")).toEqual(["circle#c1 moved to (130,100)"]);
    expect(run("undo")).toEqual(["circle#c1 moved back to (100,100)"]);
    expect(run("redo")).toEqual(["circle#c1 moved to (130,100)"]);
    run('create text title 20 40 "My Diagram"');
    expect(run('set title text "My Diagram v2"')).toEqual(['text#title updated: text="My Diagram v2"']);
    expect(run("undo")).toEqual(['text#title updated: text="My Diagram"']);
    expect(run("redo")).toEqual(['text#title updated: text="My Diagram v2"']);
    expect(run("set c1 stroke blue")).toEqual(["circle#c1 updated: stroke=blue"]);
    expect(run("undo")).toEqual(["circle#c1 updated: stroke=<unset>"]);
    expect(run("scale c1 2")).toEqual(["circle#c1 scaled by 2"]);
    expect(run("undo")).toEqual(["circle#c1 scale restored"]);
    expect(run("redo")).toEqual(["circle#c1 scaled by 2"]);
  });

  it("allows IDs named in and preserves case-sensitive IDs", () => {
    const { run, session } = setup();
    run("init");
    expect(run("create g in")).toEqual(["g#in created"]);
    expect(run("create g R1 in in")).toEqual(["g#R1 created in g#in"]);
    expect(run("create g r1 in in")).toEqual(["g#r1 created in g#in"]);
    expect(session.requireDocument().requireContainer("in").children.map((shape) => shape.id)).toEqual(["R1", "r1"]);
  });

  it("connects hierarchy operations and preserves the same history for every command", () => {
    const { run, session } = setup();
    run("init");
    run("create g scene");
    run("create rect r1 1 2 3 4 in scene");
    run("create circle c1 10 20 5 in scene");
    expect(run("group markers r1 c1")).toEqual(["g#markers created with 2 children"]);
    expect(run("move markers 0 100")).toEqual(["g#markers moved by (0,100)"]);
    expect(run("undo")).toEqual(["g#markers moved back by (0,-100)"]);
    expect(run("ungroup markers")).toEqual(["g#markers ungrouped (2 children promoted)"]);
    expect(run("undo")).toEqual(["g#markers restored into g#scene"]);
    expect(run("redo")).toEqual(["g#markers ungrouped (2 children promoted)"]);
    run("create g other in scene");
    expect(run("addto other r1")).toEqual(["rect#r1 moved into g#other"]);
    expect(run("undo")).toEqual(["rect#r1 restored into g#scene"]);
    expect(run("front r1")).toEqual(["rect#r1 moved to front"]);
    expect(run("back r1")).toEqual(["rect#r1 moved to back"]);
    expect(run("undo")).toEqual(["rect#r1 z-order restored"]);
    expect(run("delete other")).toEqual(["g#other deleted"]);
    expect(run("undo")).toEqual(["g#other restored into g#scene"]);
    expect(run("tree scene")[0]).toBe("g#scene");
    expect(run("show r1")[0]).toBe("rect#r1  parent=g#scene");
    expect(session.requireDocument().requireShape("r1").getAttribute("y")).toBe(2);
  });

  it("prints read warnings before the summary, saves to the source path and replaces current targets", () => {
    const { run, files, session } = setup();
    files.files.set("external drawing.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect x="1" y="2" width="3" height="4"/></svg>');
    run("init");
    run("create rect rect1 100 100 10 10");
    const old = session.requireDocument();
    expect(run('read "external drawing.svg"')).toEqual([
      "warning: assigned id rect1 to unnamed <rect>", "read external drawing.svg (1 elements)",
    ]);
    expect(run("move rect1 5 0")).toEqual(["rect#rect1 moved to (6,2)"]);
    expect(old.requireShape("rect1").getAttribute("x")).toBe(100);
    expect(run("save")).toEqual(["saved to external drawing.svg (1 elements)"]);
    expect(run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(run("redo")).toEqual(["error: undo not allowed after io command"]);
    expect(run("tree")[0]).toBe("svg (400x200)");
    expect(files.files.get("external drawing.svg")).toContain('x="6"');
  });

  it("keeps both stacks for queries and starts new history at document boundaries", () => {
    const { run, session } = setup();
    run("init");
    run("create rect r1 1 2 3 4");
    run("move r1 5 0");
    run("undo");
    const executor = session.executor;
    const undo = executor.history.peekUndo();
    const redo = executor.history.peekRedo();
    expect(run("canvas")).toEqual(["canvas 800x600"]);
    run("tree"); run("show r1"); run("help");
    expect(executor.history.peekUndo()).toBe(undo);
    expect(executor.history.peekRedo()).toBe(redo);
    expect(run("canvas 800 600")).toEqual(["canvas resized to 800x600"]);
    for (const query of ["canvas", "tree", "help", "show r1"]) run(query);
    expect(run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(run("move r1 bad 1")[0]).toMatch(/^error:/);
    expect(run("redo")).toEqual(["error: undo not allowed after io command"]);
    run("move r1 5 0"); run("undo");
    expect(run("undo")).toEqual(["error: nothing to undo"]);
    run("redo");
    expect(session.requireDocument().requireShape("r1").getAttribute("x")).toBe(6);
    expect(run("init 400 200")).toEqual(["canvas 400x200 created"]);
    expect(run("save")).toEqual(["error: no save path. specify a file path"]);
  });

  it.each([
    ["create rect r1 0 0 1 1", "id already exists: r1"],
    ["move missing 1 2", "no such shape: missing"],
    ["create g nested in missing", "no such container: missing"],
    ["create g nested in r1", "not a container: r1"],
    ["create box n1 0 0 1 1", "unknown shape type: box (is the plugin loaded?)"],
    ["set r1 label text", "unknown attribute: label"],
    ["scale r1 0", "scale factor must be positive"],
    ["read missing.svg", "cannot read file: missing.svg"],
    ["ungroup scene", "cannot ungroup top-level container: scene"],
    ["group bad scene r1", "cannot group a container into its own descendant: scene"],
  ])("preserves the document and both stack tops on semantic failure: %s", (line, error) => {
    const { run, session } = setup();
    run("init"); run("create g scene"); run("create rect r1 1 2 3 4 in scene"); run("move r1 1 0"); run("undo");
    const document = session.requireDocument();
    const before = captureDocument(document);
    const undo = session.executor.history.peekUndo();
    const redo = session.executor.history.peekRedo();
    expect(run(line)).toEqual([`error: ${error}`]);
    expectDocumentUnchanged(document, before);
    expect(session.executor.history.peekUndo()).toBe(undo);
    expect(session.executor.history.peekRedo()).toBe(redo);
  });

  it.each([
    "init 1 2 3", "canvas 20", "help extra", "tree a b", "show", "undo extra", "redo extra",
    "delete r1 extra", "move r1 1", "scale r1 2 extra", "set r1 x", "group only", "group new r1", "ungroup",
    "addto scene", "front r1 extra", "back", "read", "save one.svg two.svg",
    "create rect new 1 2 3", "create g new extra", "create circle new 0 0 1 red extra",
    'create text new 0 0 unquoted', 'set t1 text unquoted', 'set r1 x ""',
    'create rect new "" 0 1 1', "move r1 1foo 0", "move r1 NaN 0", "move r1 1e309 0",
    "create g new in", 'set t1 text "unfinished', "unknown-command",
  ])("rejects malformed input before changing state: %s", (line) => {
    const { run, session } = setup();
    run("init"); run("create rect r1 1 2 3 4"); run('create text t1 0 0 "text"');
    const document = session.requireDocument();
    const before = captureDocument(document);
    const top = session.executor.history.peekUndo();
    const result = run(line);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^error: /);
    expect(result[0]).not.toContain("\n");
    expectDocumentUnchanged(document, before);
    expect(session.executor.history.peekUndo()).toBe(top);
  });

  it("preserves source path and history after write failure and rejects whitespace numeric sets", () => {
    const { run, session, files } = setup();
    run("init"); run("create rect r1 1 2 3 4");
    files.unwritable.add("locked.svg");
    const top = session.executor.history.peekUndo();
    expect(run("save locked.svg")).toEqual(["error: cannot write file: locked.svg"]);
    expect(session.executor.history.peekUndo()).toBe(top);
    expect(run('set r1 stroke-width " "')).toEqual(["error: invalid number for stroke-width"]);
    expect(run("set r1 width 1e2")).toEqual(["rect#r1 updated: width=100"]);
    expect(run("undo")).toEqual(["rect#r1 updated: width=3"]);
  });

  it("does not print partial import warnings or change history when later SVG content is invalid", () => {
    const { files, session, run } = setup();
    run("init"); run("create rect r1 1 2 3 4");
    const document = session.requireDocument(), before = captureDocument(document);
    const top = session.executor.history.peekUndo();
    files.files.set("bad.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">'
      + '<rect x="0" y="0" width="1" height="1"/><g id="g1" transform="translate(1,2)"/></svg>');
    const output = run("read bad.svg");
    expect(output).toHaveLength(1);
    expect(output[0]).toMatch(/^error: invalid svg:/);
    expect(output.join("\n")).not.toContain("warning:");
    expect(session.currentDocument).toBe(document);
    expectDocumentUnchanged(document, before);
    expect(session.executor.history.peekUndo()).toBe(top);
  });

  it("keeps create/group/delete feedback correct through full subtree undo and redo", () => {
    const { run, session } = setup();
    run("init"); run("create g scene"); run("create rect r1 1 2 3 4 in scene");
    expect(run("undo")).toEqual(["rect#r1 removed"]);
    expect(run("redo")).toEqual(["rect#r1 created in g#scene"]);
    run("create circle c1 10 20 5 in scene");
    run("group pair r1 c1");
    expect(run("undo")).toEqual(["g#pair ungrouped"]);
    expect(run("redo")).toEqual(["g#pair created with 2 children"]);
    run("delete pair");
    expect(session.requireDocument().findById("r1")).toBeUndefined();
    expect(run("undo")).toEqual(["g#pair restored into g#scene"]);
    expect(session.requireDocument().requireShape("r1").parent?.id).toBe("pair");
    expect(run("redo")).toEqual(["g#pair deleted"]);
  });

  it("clears redo on a successful new branch while keeping subsequent feedback usable", () => {
    const { run, session } = setup();
    run("init"); run("create rect r1 1 2 3 4"); run("move r1 10 0"); run("undo");
    run("set r1 stroke blue");
    expect(run("redo")).toEqual(["error: nothing to redo"]);
    expect(run("undo")).toEqual(["rect#r1 updated: stroke=<unset>"]);
    expect(run("redo")).toEqual(["rect#r1 updated: stroke=blue"]);
    expect(session.requireDocument().requireShape("r1").getAttribute("x")).toBe(1);
  });

  it("emits one error prefix and one line while retaining history on serialization failure", () => {
    const files = new MemoryFileSystem();
    const session = new DocumentSession(files, new SvgReader(), { write: () => { throw new Error("error: serialization\nfailed"); } });
    const cli = new SvgCli(session);
    cli.run("init"); cli.run("create rect r1 1 2 3 4");
    const top = session.executor.history.peekUndo();
    expect(cli.run("save out.svg")).toEqual(["error: serialization failed"]);
    expect(files.files.has("out.svg")).toBe(false);
    expect(session.executor.history.peekUndo()).toBe(top);
  });
});
