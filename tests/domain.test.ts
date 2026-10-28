import { describe, expect, it } from "vitest";

import {
  Circle,
  Document,
  DomainError,
  Ellipse,
  Group,
  Line,
  Rect,
  ShapeFactory,
  Text,
} from "../src/domain/index.js";

describe("Document", () => {
  it("creates an empty document with the default canvas size", () => {
    const document = new Document();

    expect(document.width).toBe(800);
    expect(document.height).toBe(600);
    expect(document.children).toHaveLength(0);
    expect(document.size).toBe(0);
  });

  it("accepts an explicitly sized canvas", () => {
    const document = Document.createEmpty(400, 200);

    expect(document.width).toBe(400);
    expect(document.height).toBe(200);
  });

  it("enforces case-sensitive unique ids across the whole tree", () => {
    const document = new Document();
    const group = new Group("g1");

    document.add(group);
    document.add(new Rect("r1", 0, 0, 10, 10), "g1");
    document.add(new Circle("R1", 0, 0, 5));

    expect(document.findById("r1")).toBeInstanceOf(Rect);
    expect(document.findById("R1")).toBeInstanceOf(Circle);
    expect(() => document.add(new Circle("r1", 0, 0, 5))).toThrow(
      "id already exists: r1",
    );
  });

  it("attaches shapes to an existing group and rejects invalid parents atomically", () => {
    const document = new Document();
    const group = new Group("g1");
    const rootShape = new Rect("root", 0, 0, 10, 10);

    document.add(group);
    document.add(rootShape);

    const nested = new Circle("nested", 1, 1, 2);
    document.add(nested, "g1");
    expect(nested.parent).toBe(group);
    expect(group.children).toEqual([nested]);

    const missingParentShape = new Rect("missing-parent", 0, 0, 1, 1);
    expect(() => document.add(missingParentShape, "missing")).toThrow(
      "no such container: missing",
    );
    expect(document.findById("missing-parent")).toBeUndefined();

    const nonContainerShape = new Rect("leaf", 0, 0, 1, 1);
    document.add(nonContainerShape);
    const invalidParentShape = new Rect("invalid-parent", 0, 0, 1, 1);
    expect(() => document.add(invalidParentShape, "leaf")).toThrow(
      "not a container: leaf",
    );
    expect(document.findById("invalid-parent")).toBeUndefined();
  });

  it("rejects a duplicate id hidden inside a detached subtree", () => {
    const document = new Document();
    document.add(new Rect("r1", 0, 0, 10, 10));

    const group = new Group("g1");
    group.addChild(new Circle("r1", 1, 1, 2));

    expect(() => document.add(group)).toThrow("id already exists: r1");
    expect(group.parent).toBeNull();
    expect(document.children).toHaveLength(1);
  });

  it("prevents a document-owned root from bypassing Document when reparented", () => {
    const document = new Document();
    const rootGroup = new Group("root-group");
    const detachedGroup = new Group("detached-group");

    document.add(rootGroup);

    expect(() => detachedGroup.addChild(rootGroup)).toThrow(
      "shape already belongs to a document",
    );
    expect(document.children).toEqual([rootGroup]);
    expect(rootGroup.parent).toBeNull();
  });
});

describe("shape model", () => {
  it("stores the six built-in shape types and their attributes", () => {
    const rect = new Rect("r1", 10, 20, 100, 50, {
      fill: "#eee",
      stroke: "black",
      strokeWidth: 2,
    });
    const circle = new Circle("c1", 100, 100, 20, { fill: "red" });
    const ellipse = new Ellipse("e1", 10, 20, 30, 40);
    const line = new Line("l1", 0, 1, 20, 21, { stroke: "black" });
    const text = new Text("t1", 20, 40, "My Diagram");
    const group = new Group("g1");

    expect(rect.kind).toBe("rect");
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
    expect(rect.fill).toBe("#eee");
    expect(rect.stroke).toBe("black");
    expect(rect.strokeWidth).toBe(2);
    expect(circle.kind).toBe("circle");
    expect([circle.cx, circle.cy, circle.r]).toEqual([100, 100, 20]);
    expect(ellipse.kind).toBe("ellipse");
    expect([ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry]).toEqual([
      10,
      20,
      30,
      40,
    ]);
    expect(line.kind).toBe("line");
    expect([line.x1, line.y1, line.x2, line.y2]).toEqual([0, 1, 20, 21]);
    expect(text.kind).toBe("text");
    expect(text.x).toBe(20);
    expect(text.y).toBe(40);
    expect(text.content).toBe("My Diagram");
    expect(group.kind).toBe("g");
    expect(group.children).toHaveLength(0);
  });

  it("moves and scales every leaf using SVG coordinates", () => {
    const rect = new Rect("r1", 10, 20, 100, 50);
    const circle = new Circle("c1", 10, 20, 5);
    const ellipse = new Ellipse("e1", 10, 20, 30, 40);
    const line = new Line("l1", 1, 2, 3, 4);
    const text = new Text("t1", 10, 20, "text");

    rect.move(5, -2);
    circle.move(5, -2);
    ellipse.move(5, -2);
    line.move(5, -2);
    text.move(5, -2);

    expect([rect.x, rect.y]).toEqual([15, 18]);
    expect([circle.cx, circle.cy]).toEqual([15, 18]);
    expect([ellipse.cx, ellipse.cy]).toEqual([15, 18]);
    expect([line.x1, line.y1, line.x2, line.y2]).toEqual([6, 0, 8, 2]);
    expect([text.x, text.y]).toEqual([15, 18]);

    rect.scale(2);
    circle.scale(2);
    ellipse.scale(2);
    line.scale(2);
    text.scale(2);

    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([30, 36, 200, 100]);
    expect([circle.cx, circle.cy, circle.r]).toEqual([30, 36, 10]);
    expect([ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry]).toEqual([
      30,
      36,
      60,
      80,
    ]);
    expect([line.x1, line.y1, line.x2, line.y2]).toEqual([12, 0, 16, 4]);
    expect([text.x, text.y]).toEqual([30, 36]);
  });

  it("supports the common and type-specific attribute whitelist", () => {
    const rect = new Rect("r1", 0, 0, 10, 10);
    const text = new Text("t1", 0, 0, "old");

    rect.setAttribute("x", 5);
    rect.setAttribute("fill", "#fff");
    rect.setAttribute("stroke-width", 3);
    text.setAttribute("text", "new text");

    expect(rect.x).toBe(5);
    expect(rect.fill).toBe("#fff");
    expect(rect.strokeWidth).toBe(3);
    expect(text.content).toBe("new text");
    expect(rect.getAttribute("x")).toBe(5);
    expect(rect.getAttribute("fill")).toBe("#fff");
    expect(text.getAttribute("text")).toBe("new text");
    expect(() => rect.setAttribute("r", 2)).toThrow(
      "unknown attribute: r",
    );
  });

  it("rejects non-positive scale factors before changing state", () => {
    const rect = new Rect("r1", 10, 20, 30, 40);

    expect(() => rect.scale(0)).toThrow("scale factor must be positive");
    expect(() => rect.scale(-1)).toThrow("scale factor must be positive");
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([10, 20, 30, 40]);
  });
});

describe("Group composite", () => {
  it("keeps ordered children and applies move/scale recursively", () => {
    const group = new Group("g1");
    const nested = new Group("nested");
    const rect = new Rect("r1", 10, 20, 30, 40);
    const text = new Text("t1", 15, 25, "node");

    nested.addChild(rect);
    group.addChild(nested);
    group.addChild(text);
    group.move(5, 10);

    expect(group.children).toEqual([nested, text]);
    expect(rect.parent).toBe(nested);
    expect(text.parent).toBe(group);
    expect([rect.x, rect.y, text.x, text.y]).toEqual([15, 30, 20, 35]);

    group.scale(2);
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([30, 60, 60, 80]);
    expect([text.x, text.y]).toEqual([40, 70]);
  });

  it("rejects cycles and multiple parents", () => {
    const outer = new Group("outer");
    const inner = new Group("inner");
    const rect = new Rect("r1", 0, 0, 1, 1);

    outer.addChild(inner);
    inner.addChild(rect);

    expect(() => inner.addChild(outer)).toThrow(DomainError);
    expect(() => outer.addChild(rect)).toThrow("shape already has a parent");
  });
});

describe("ShapeFactory", () => {
  it("creates all built-in shapes from positional parameters", () => {
    expect(ShapeFactory.create("rect", "r1", 1, 2, 3, 4, "red")).toBeInstanceOf(
      Rect,
    );
    expect(ShapeFactory.create("circle", "c1", 1, 2, 3, "red")).toBeInstanceOf(
      Circle,
    );
    expect(
      ShapeFactory.create("ellipse", "e1", 1, 2, 3, 4, "red"),
    ).toBeInstanceOf(Ellipse);
    expect(ShapeFactory.create("line", "l1", 1, 2, 3, 4, "black")).toBeInstanceOf(
      Line,
    );
    expect(ShapeFactory.create("text", "t1", 1, 2, "hello")).toBeInstanceOf(
      Text,
    );
    expect(ShapeFactory.create("g", "g1")).toBeInstanceOf(Group);
  });

  it("creates shapes from typed specifications and rejects unknown types", () => {
    const rect = ShapeFactory.create({
      type: "rect",
      id: "r1",
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      fill: "#eee",
    });

    expect(rect).toBeInstanceOf(Rect);
    expect((rect as Rect).fill).toBe("#eee");
    expect(() => ShapeFactory.create("box", "box1")).toThrow(
      "unknown shape type: box (is the plugin loaded?)",
    );
  });
});
