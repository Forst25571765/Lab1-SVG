import { describe, expect, it } from "vitest";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { SvgCli } from "../src/cli/SvgCli.js";
import { Circle, Document, DomainError, Ellipse, Group, Line, Rect, Text, type ShapeOptions } from "../src/domain/index.js";
import { SvgReader, SvgWriter } from "../src/infrastructure/index.js";
import { MemoryFileSystem } from "./helpers/MemoryFileSystem.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

// Independent SVG constraints: positions may be negative; dimensions/radii/stroke widths may not.
const shapes = [
  { kind: "rect", create: "create rect target -1 -2 3 4", sizes: ["width", "height"],
    construct: (options: ShapeOptions) => new Rect("target", -1, -2, 3, 4, options) },
  { kind: "circle", create: "create circle target -1 -2 3", sizes: ["r"],
    construct: (options: ShapeOptions) => new Circle("target", -1, -2, 3, options) },
  { kind: "ellipse", create: "create ellipse target -1 -2 3 4", sizes: ["rx", "ry"],
    construct: (options: ShapeOptions) => new Ellipse("target", -1, -2, 3, 4, options) },
  { kind: "line", create: "create line target -1 -2 -3 -4", sizes: [],
    construct: (options: ShapeOptions) => new Line("target", -1, -2, -3, -4, options) },
  { kind: "text", create: 'create text target -1 -2 "text"', sizes: [],
    construct: (options: ShapeOptions) => new Text("target", -1, -2, "text", options) },
  { kind: "g", create: "create g target", sizes: [],
    construct: (options: ShapeOptions) => new Group("target", options) },
];

const dimensions = [
  { name: "canvas width", attribute: "width", create: (value: number) => new Document(value, 20) },
  { name: "canvas height", attribute: "height", create: (value: number) => new Document(20, value) },
  { name: "rect width", attribute: "width", create: (value: number) => new Rect("r", 0, 0, value, 20) },
  { name: "rect height", attribute: "height", create: (value: number) => new Rect("r", 0, 0, 20, value) },
  { name: "circle radius", attribute: "r", create: (value: number) => new Circle("c", 0, 0, value) },
  { name: "ellipse rx", attribute: "rx", create: (value: number) => new Ellipse("e", 0, 0, value, 20) },
  { name: "ellipse ry", attribute: "ry", create: (value: number) => new Ellipse("e", 0, 0, 20, value) },
];

const invalidCreates = [
  { command: "create rect bad 0 0 -1 2 in scene", attribute: "width" },
  { command: "create rect bad 0 0 1 -0.5 in scene", attribute: "height" },
  { command: "create circle bad 0 0 -1e-2 in scene", attribute: "r" },
  { command: "create ellipse bad 0 0 -1 2 in scene", attribute: "rx" },
  { command: "create ellipse bad 0 0 1 -2 in scene", attribute: "ry" },
];

const invalidCanvas = [
  { command: "init -1 200", attribute: "width" },
  { command: "init 400 -1", attribute: "height" },
  { command: "canvas -1 200", attribute: "width" },
  { command: "canvas 400 -1", attribute: "height" },
];

function svg(body: string, width = "320", height = "240"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`;
}

function setup(create = "create rect target 1 2 3 4") {
  const files = new MemoryFileSystem();
  files.files.set("source.svg", svg('<g id="scene"/>'));
  const session = new DocumentSession(files, new SvgReader(), new SvgWriter());
  const cli = new SvgCli(session);
  expect(cli.run("read source.svg")[0]).not.toMatch(/^error:/);
  expect(cli.run(`${create} in scene`)[0]).not.toMatch(/^error:/);
  expect(cli.run("set target fill blue")[0]).not.toMatch(/^error:/);
  const afterEdit = captureDocument(session.requireDocument());
  expect(cli.run("undo")[0]).not.toMatch(/^error:/);
  return { files, session, cli, afterEdit };
}

function expectRejected(context: ReturnType<typeof setup>, command: string, attribute: string): void {
  const { files, session, cli, afterEdit } = context;
  const document = session.requireDocument();
  const before = captureDocument(document);
  const oldPath = session.sourcePath;
  const oldFiles = new Map(files.files);
  const history = session.executor.history;
  const undo = history.peekUndo(), redo = history.peekRedo();
  const counts = [history.undoCount, history.redoCount];
  expect(cli.run(command)).toEqual([`error: invalid number for ${attribute}: must be non-negative`]);
  expect(session.currentDocument).toBe(document);
  expect(session.sourcePath).toBe(oldPath);
  expect(files.files).toEqual(oldFiles);
  expectDocumentUnchanged(document, before);
  expect([history.undoCount, history.redoCount]).toEqual(counts);
  expect(history.peekUndo()).toBe(undo);
  expect(history.peekRedo()).toBe(redo);
  session.executor.redo();
  expectDocumentUnchanged(document, afterEdit);
  session.executor.undo();
  expectDocumentUnchanged(document, before);
}

describe("non-negative domain values", () => {
  it.each(dimensions)("rejects negative $name at construction, but accepts zero", ({ create, attribute }) => {
    for (const value of [-1, -0.25, -Number.MIN_VALUE]) {
      expect(() => create(value)).toThrow(new DomainError("invalid-number", `invalid number for ${attribute}: must be non-negative`));
    }
    expect(() => create(0)).not.toThrow();
    expect(() => create(-0)).not.toThrow();
  });

  it.each(shapes)("validates both stroke-width option spellings for $kind", ({ construct }) => {
    expect(() => construct({ strokeWidth: -1 })).toThrow("invalid number for stroke-width: must be non-negative");
    expect(() => construct({ "stroke-width": "-0.5" })).toThrow("invalid number for stroke-width: must be non-negative");
    expect(construct({ strokeWidth: 0 }).strokeWidth).toBe(0);
    expect(construct({ "stroke-width": "0" }).strokeWidth).toBe(0);
  });

  it.each([
    { width: -1, height: 200, attribute: "width" },
    { width: 400, height: -1, attribute: "height" },
  ])("rejects negative canvas $attribute without changing either dimension", ({ width, height, attribute }) => {
    const document = new Document(320, 240);
    document.add(new Rect("r", 1, 2, 3, 4));
    const before = captureDocument(document);
    expect(() => document.setCanvasSize(width, height)).toThrow(`invalid number for ${attribute}: must be non-negative`);
    expectDocumentUnchanged(document, before);
  });
});

describe("negative inputs preserve documents and history", () => {
  it.each([...invalidCreates, ...invalidCanvas])("rejects $command", ({ command, attribute }) => {
    expectRejected(setup(), command, attribute);
  });

  it.each(shapes.flatMap((shape) => [...shape.sizes, "stroke-width"].map((attribute) => ({ ...shape, attribute }))))(
    "rejects negative $kind.$attribute through domain and CLI setters", ({ create, attribute }) => {
      const context = setup(create);
      const document = context.session.requireDocument();
      const before = captureDocument(document);
      for (const value of [-1, "-0.5", -Number.MIN_VALUE]) {
        expect(() => document.requireShape("target").setAttribute(attribute, value)).toThrow(
          `invalid number for ${attribute}: must be non-negative`,
        );
        expectDocumentUnchanged(document, before);
      }
      expectRejected(context, `set target ${attribute} -1e-2`, attribute);
    },
  );

  it.each([
    ...invalidCreates, ...invalidCanvas,
    { command: "set target width -1", attribute: "width" },
    { command: "set target stroke-width -1", attribute: "stroke-width" },
    { command: "read bad.svg", attribute: "r" },
  ])("keeps the I/O history boundary after $command fails", ({ command, attribute }) => {
    const { files, session, cli } = setup();
    files.files.set("bad.svg", svg('<circle id="bad" cx="0" cy="0" r="-1"/>'));
    session.save("saved.svg");
    const document = session.requireDocument();
    const before = captureDocument(document);
    expect(cli.run(command)).toEqual([`error: invalid number for ${attribute}: must be non-negative`]);
    expect(session.currentDocument).toBe(document);
    expect(session.sourcePath).toBe("source.svg");
    expectDocumentUnchanged(document, before);
    expect(session.executor.history.undoCount).toBe(0);
    expect(session.executor.history.redoCount).toBe(0);
    expect(cli.run("undo")).toEqual(["error: undo not allowed after io command"]);
    expect(cli.run("redo")).toEqual(["error: undo not allowed after io command"]);
  });

  it("does not create a document after a negative init in a fresh session", () => {
    const session = new DocumentSession(new MemoryFileSystem(), new SvgReader(), new SvgWriter());
    expect(new SvgCli(session).run("init -1 200")).toEqual(["error: invalid number for width: must be non-negative"]);
    expect(session.currentDocument).toBeNull();
    expect(session.sourcePath).toBeNull();
    expect(session.executor.history.undoCount).toBe(0);
    expect(session.executor.history.redoCount).toBe(0);
  });
});

describe("SVG numeric constraints", () => {
  const badElements = [
    { attribute: "width", element: '<rect x="0" y="0" width="-1px" height="2"/>' },
    { attribute: "height", element: '<rect x="0" y="0" width="1" height="-2"/>' },
    { attribute: "r", element: '<circle cx="0" cy="0" r="-1e-2px"/>' },
    { attribute: "rx", element: '<ellipse cx="0" cy="0" rx="-1" ry="2"/>' },
    { attribute: "ry", element: '<ellipse cx="0" cy="0" rx="1" ry="-2px"/>' },
    { attribute: "stroke-width", element: '<line x1="0" y1="0" x2="1" y2="2" stroke-width="-0.5px"/>' },
    { attribute: "stroke-width", element: '<g stroke-width="-1"><text x="0" y="0">text</text></g>' },
  ];
  it.each([
    { name: "root width", attribute: "width", source: svg("", "-320px") },
    { name: "root height", attribute: "height", source: svg("", "320", "-2.4e2") },
    ...badElements.map(({ attribute, element }) => ({
      name: element, attribute, source: svg(`<g><rect x="0" y="0" width="1" height="2"/>${element}</g>`),
    })),
  ])("rejects $name without leaking partial imports or warnings", ({ attribute, source }) => {
    const context = setup();
    context.files.files.set("bad.svg", source);
    expectRejected(context, "read bad.svg", attribute);
  });

  it.each(shapes)("preserves negative positions and zero sizes/stroke width for $kind", ({ create, sizes }) => {
    const { cli, session } = setup(create);
    for (const attribute of [...sizes, "stroke-width"]) {
      expect(cli.run(`set target ${attribute} 0`)[0]).not.toMatch(/^error:/);
      expect(session.requireDocument().requireShape("target").getAttribute(attribute)).toBe(0);
    }
    const document = session.requireDocument();
    const beforeMove = captureDocument(document);
    expect(cli.run("move target -2 -3")[0]).not.toMatch(/^error:/);
    expect(cli.run("scale target 0.5")[0]).not.toMatch(/^error:/);
    const afterScale = captureDocument(document);
    session.executor.undo();
    session.executor.undo();
    expectDocumentUnchanged(document, beforeMove);
    session.executor.redo();
    session.executor.redo();
    expectDocumentUnchanged(document, afterScale);
    const copy = new SvgReader().read(new SvgWriter().write(document)).document;
    expect(captureDocument(copy).values).toEqual(afterScale.values);
  });

  it("accepts zero canvas and shape dimensions on create, import and save", () => {
    const { files, session, cli } = setup();
    expect(cli.run("init 0 0")).toEqual(["canvas 0x0 created"]);
    for (const command of [
      "create rect r -1 -2 0 0", "create circle c -1 -2 0", "create ellipse e -1 -2 0 0",
      "set r stroke-width -0", "canvas 0 200", "canvas 300 0", "canvas 0 0",
    ]) expect(cli.run(command)[0]).not.toMatch(/^error:/);
    expect(cli.run("save zero.svg")[0]).not.toMatch(/^error:/);
    const saved = files.files.get("zero.svg")!;
    expect(saved).toContain('viewBox="0 0 0 0"');
    expect(cli.run("read zero.svg")[0]).not.toMatch(/^error:/);
    const document = session.requireDocument();
    expect([document.width, document.height, document.size]).toEqual([0, 0, 3]);
    expect(document.requireShape("r").getAttributes()).toMatchObject({ x: -1, y: -2, width: 0, height: 0, "stroke-width": 0 });
    expect(document.requireShape("c").getAttribute("r")).toBe(0);
    expect(document.requireShape("e").getAttributes()).toMatchObject({ rx: 0, ry: 0 });
  });
});
