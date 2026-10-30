import { describe, expect, it } from "vitest";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { SvgCli } from "../src/cli/SvgCli.js";
import { ShapeFactory } from "../src/domain/index.js";
import { SvgReader, SvgWriter } from "../src/infrastructure/index.js";
import { MemoryFileSystem } from "./helpers/MemoryFileSystem.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

// Independent cases transcribed from phase_cli_1 §4.1, not generated from factory metadata.
const shapes = [
  { kind: "rect", create: "create rect target 1 2 3 4", geometry: ["x", "y", "width", "height"], foreign: "cx" },
  { kind: "circle", create: "create circle target 1 2 3", geometry: ["cx", "cy", "r"], foreign: "width" },
  { kind: "ellipse", create: "create ellipse target 1 2 3 4", geometry: ["cx", "cy", "rx", "ry"], foreign: "r" },
  { kind: "line", create: "create line target 1 2 3 4", geometry: ["x1", "y1", "x2", "y2"], foreign: "x" },
  { kind: "text", create: 'create text target 1 2 "原文"', geometry: ["x", "y"], foreign: "r" },
  { kind: "g", create: "create g target", geometry: [], foreign: "x" },
];

function setup(create: string) {
  const session = new DocumentSession(new MemoryFileSystem(), new SvgReader(), new SvgWriter());
  const cli = new SvgCli(session);
  expect(cli.run("init")).toEqual(["canvas 800x600 created"]);
  expect(cli.run(create)[0]).not.toMatch(/^error:/);
  return { session, cli, document: session.requireDocument() };
}

describe("complete attribute whitelist", () => {
  const cases = shapes.flatMap((shape) => [
    ...shape.geometry.map((attribute) => ({ ...shape, attribute, input: "1.25e2", value: 125 })),
    ...["fill", "stroke"].map((attribute) => ({ ...shape, attribute, input: "#123abc", value: "#123abc" })),
    { ...shape, attribute: "stroke-width", input: "0.75", value: 0.75 },
    ...(shape.kind === "text" ? [{ ...shape, attribute: "text", input: '"更新 & <内容> # in"', value: "更新 & <内容> # in" }] : []),
  ]);

  it.each(cases)("sets, undoes, redoes and serializes $kind.$attribute", ({ create, attribute, input, value }) => {
    const { session, cli, document } = setup(create);
    const before = captureDocument(document);
    expect(cli.run(`set target ${attribute} ${input}`)[0]).not.toMatch(/^error:/);
    expect(document.requireShape("target").getAttribute(attribute)).toBe(value);
    const edited = captureDocument(document);
    expect(session.executor.history.undoCount).toBe(2);
    expect(cli.run("undo")[0]).not.toMatch(/^error:/);
    expectDocumentUnchanged(document, before);
    expect(cli.run("redo")[0]).not.toMatch(/^error:/);
    expectDocumentUnchanged(document, edited);
    const copy = new SvgReader().read(new SvgWriter().write(document)).document;
    expect(captureDocument(copy).values).toEqual(edited.values);
  });

  it.each(shapes)("rejects another type's geometry and id changes on $kind", ({ create, foreign }) => {
    const { session, cli, document } = setup(create);
    cli.run("set target fill red");
    cli.run("undo");
    const before = captureDocument(document);
    const undo = session.executor.history.peekUndo(), redo = session.executor.history.peekRedo();
    for (const attribute of [foreign, "id", "transform", "label"]) {
      expect(cli.run(`set target ${attribute} 5`)).toEqual([`error: unknown attribute: ${attribute}`]);
      expectDocumentUnchanged(document, before);
      expect(session.executor.history.peekUndo()).toBe(undo);
      expect(session.executor.history.peekRedo()).toBe(redo);
    }
  });

  it.each(shapes.flatMap((shape) => [...shape.geometry, "stroke-width"].map((attribute) => ({ ...shape, attribute }))))(
    "rejects non-finite domain writes without changing $kind.$attribute", ({ create, attribute }) => {
      const { document } = setup(create);
      const before = captureDocument(document);
      for (const value of [NaN, Infinity, -Infinity, "not-a-number"]) {
        expect(() => document.requireShape("target").setAttribute(attribute, value)).toThrow(`invalid number for ${attribute}`);
        expectDocumentUnchanged(document, before);
      }
    },
  );

  it("returns factory metadata copies that cannot change later creation or help", () => {
    const types = ShapeFactory.types as string[];
    types.length = 0;
    const schema = ShapeFactory.parametersFor("rect") as unknown as { name: string }[];
    schema[0].name = "broken";
    schema.length = 0;
    expect(ShapeFactory.types).toEqual(["rect", "circle", "ellipse", "line", "text", "g"]);
    const { cli, document } = setup("create rect target 1 2 3 4");
    expect(document.requireShape("target").getAttribute("x")).toBe(1);
    expect(cli.run("help").join("\n")).toContain("create rect <id> <x> <y> <w> <h>");
  });
});
