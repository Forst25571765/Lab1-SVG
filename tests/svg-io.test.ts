import { describe, expect, it } from "vitest";
import { BackCommand, FrontCommand } from "../src/commands/index.js";
import { Circle, Document, Ellipse, Group, Line, Rect, Text } from "../src/domain/index.js";
import { SvgReader } from "../src/infrastructure/SvgReader.js";
import { SvgWriter } from "../src/infrastructure/SvgWriter.js";
import { captureDocument } from "./helpers/documentState.js";

const reader = new SvgReader();
const writer = new SvgWriter();
const svg = (content: string, attributes = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" ${attributes}>${content}</svg>`;

describe("SVG read and write", () => {
  it("writes a valid empty canvas with namespace, dimensions and matching viewBox", () => {
    const output = writer.write(new Document());
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(output).toContain('width="800"');
    expect(output).toContain('height="600"');
    expect(output).toContain('viewBox="0 0 800 600"');
    const result = reader.read(output);
    expect([result.document.width, result.document.height, result.document.size]).toEqual([800, 600, 0]);
    expect(result.warnings).toEqual([]);
  });

  it("round-trips all six types, nested groups, styles, exact text and drawing order", () => {
    const document = new Document(400, 200);
    const group = new Group("scene", { fill: "red", stroke: "#123456", strokeWidth: 0.5 });
    const nested = new Group("nested");
    document.add(group);
    document.add(new Rect("r1", -1.25, 2, 30, 40), group);
    document.add(nested, group);
    document.add(new Circle("c1", 5, 6, 7, { fill: "none" }), nested);
    document.add(new Ellipse("e1", 10, 20, 3, 4), nested);
    document.add(new Line("l1", 1, 2, 3, 4, { stroke: "black", strokeWidth: 2 }), group);
    document.add(new Text("t&\"1", 20, 40, '  开始 & <数据> "引号" 😀\n下一行  '), group);
    const before = captureDocument(document);

    const output = writer.write(document);
    expect(output).toContain("&amp;");
    expect(output).toContain("&lt;");
    expect(output).not.toContain(' text="');
    const copy = reader.read(output).document;
    const after = captureDocument(copy);
    expect([after.width, after.height, after.roots, after.values]).toEqual(
      [before.width, before.height, before.roots, before.values],
    );
    expect(copy.requireShape("r1").fill).toBeUndefined();
    expect(copy.requireShape("e1").stroke).toBeUndefined();
    expect(captureDocument(document)).toEqual(before);
  });

  it("reserves explicit IDs throughout the file before assigning missing and empty IDs", () => {
    const result = reader.read(svg(`
      <rect x="0" y="0" width="1" height="2"/>
      <g><rect id="rect1" x="1" y="2" width="3" height="4"/></g>
      <g id="g1"><rect id="" x="2" y="3" width="4" height="5"/></g>
      <rect id="Rect2" x="0" y="0" width="1" height="1"/>
    `));
    expect(result.warnings).toEqual([
      "warning: assigned id rect2 to unnamed <rect>",
      "warning: assigned id g2 to unnamed <g>",
      "warning: assigned id rect3 to unnamed <rect>",
    ]);
    expect(result.document.children.map((shape) => shape.id)).toEqual(["rect2", "g2", "g1", "Rect2"]);
    captureDocument(result.document);
    expect(reader.read(svg('<g/>')).warnings).toEqual(["warning: assigned id g1 to unnamed <g>"]);
  });

  it("rejects duplicate explicit IDs across branches without renaming them", () => {
    expect(() => reader.read(svg('<g id="same"/><g id="other"><g id="same"/></g>')))
      .toThrow("id already exists: same");
  });

  it("reads the external SVG example, comments and a plain g carrying a box marker", () => {
    const result = reader.read(`<?xml version="1.0" encoding="UTF-8"?>${svg(`
      <!-- external file -->
      <rect x="0" y="0" width="400" height="200" fill="#ffffff"/>
      <text id="t1" x="10" y="190"><![CDATA[  imported & 中文  ]]></text>
      <circle id="c1" cx="50" cy="50" r="10"/>
      <g id="g1" data-kind="box"><rect id="r2" x="0" y="0" width="10" height="10"/>
        <circle id="c2" cx="5" cy="5" r="2"/></g>
      <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
    `)}`);
    expect(result.document.size).toBe(7);
    expect(result.document.requireShape("t1").getAttribute("text")).toBe("  imported & 中文  ");
    expect(result.document.requireShape("g1")).toBeInstanceOf(Group);
    expect(result.warnings).toEqual(["warning: assigned id rect1 to unnamed <rect>"]);
    captureDocument(result.document);
  });

  it("preserves front/back order when writing and reading overlapping shapes", () => {
    const document = new Document(120, 120);
    document.add(new Rect("red", 0, 0, 80, 80, { fill: "red" }));
    document.add(new Rect("blue", 20, 20, 80, 80, { fill: "blue" }));
    new FrontCommand(document, "red").execute();
    const front = reader.read(writer.write(document)).document;
    expect(front.children.map((shape) => shape.id)).toEqual(["blue", "red"]);
    new BackCommand(document, "red").execute();
    expect(reader.read(writer.write(document)).document.children.map((shape) => shape.id))
      .toEqual(["red", "blue"]);
  });

  it.each([
    ["malformed XML", '<svg width="400" height="200"><g></svg>'],
    ["wrong root", '<html/>'],
    ["invalid numeric attribute", svg('<circle id="c1" cx="NaN" cy="0" r="1"/>')],
    ["unsupported transform", svg('<g id="g1" transform="translate(10,20)"/>')],
    ["unsupported viewBox", svg("", 'viewBox="10 0 400 200"')],
    ["unsupported text children", svg('<text id="t1" x="0" y="0"><tspan>hello</tspan></text>')],
    ["unsupported XML instructions in text", svg('<text id="t1" x="0" y="0"><?custom value?>hello</text>')],
    ["children inside a leaf", svg('<rect id="r1" x="0" y="0" width="1" height="1"><g id="g1"/></rect>')],
  ])("rejects %s rather than silently changing the imported drawing", (_name, source) => {
    expect(() => reader.read(source)).toThrow();
  });

  it("uses the factory's unknown-type error for unsupported shapes", () => {
    expect(() => reader.read(svg('<path id="p1"/>')))
      .toThrow("unknown shape type: path (is the plugin loaded?)");
  });

  it("accepts decimal, exponent and px lengths while rejecting unsupported percentage units", () => {
    const result = reader.read('<svg xmlns="http://www.w3.org/2000/svg" width="400px" height="200px" viewBox="0 0 400 200">'
      + '<rect id="r1" x="-1.5px" y="2e1" width="30px" height="40"/></svg>');
    expect(result.document.requireShape("r1").getAttributes()).toEqual({ x: -1.5, y: 20, width: 30, height: 40 });
    expect(() => reader.read(svg('<circle id="c1" cx="50%" cy="0" r="1"/>'))).toThrow("invalid number for cx");
  });
});
