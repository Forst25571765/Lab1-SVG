import { describe, expect, it } from "vitest";
import { ShapePresenter } from "../src/cli/ShapePresenter.js";
import { FrontCommand } from "../src/commands/index.js";
import { Circle, Document, Ellipse, Group, Line, Rect, Text } from "../src/domain/index.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

const presenter = new ShapePresenter();

describe("CLI shape presentation", () => {
  it("renders all six types and nested branch markers without modifying the tree", () => {
    const document = new Document();
    const group = new Group("scene", { fill: "#eee" });
    document.add(new Rect("bg", 0, 0, 800, 600, { fill: "#fff" }));
    document.add(group);
    document.add(new Circle("c1", 100, 100, 20, { fill: "red" }), group);
    document.add(new Ellipse("e1", 1, 2, 3, 4), group);
    document.add(new Line("l1", 1, 2, 3, 4, { stroke: "black" }), group);
    document.add(new Text("t1", 20, 40, '中文 "引号"\n第二行'), group);
    const before = captureDocument(document);
    expect(presenter.tree(document)).toEqual([
      "svg (800x600)",
      "├── rect#bg  x=0 y=0 w=800 h=600 fill=#fff",
      "└── g#scene  fill=#eee",
      "    ├── circle#c1  cx=100 cy=100 r=20 fill=red",
      "    ├── ellipse#e1  cx=1 cy=2 rx=3 ry=4",
      "    ├── line#l1  (1,2) -> (3,4) stroke=black",
      String.raw`    └── text#t1  (20,40) "中文 \"引号\"\n第二行"`,
    ]);
    expect(presenter.tree(document, "scene")[0]).toBe("g#scene  fill=#eee");
    expect(presenter.tree(document, "scene")).not.toContain("svg (800x600)");
    expectDocumentUnchanged(document, before);
  });

  it("renders parent, complete geometry and only explicitly set styles", () => {
    const document = new Document(400, 200);
    const group = new Group("markers", { fill: "blue" });
    const circle = new Circle("c1", 100, 100, 20, { fill: "red", stroke: "black", strokeWidth: 2 });
    document.add(group);
    document.add(circle, group);
    expect(presenter.show(circle)).toEqual([
      "circle#c1  parent=g#markers", "  cx=100 cy=100 r=20", "  fill=red stroke=black stroke-width=2",
    ]);
    const root = new Rect("r1", 1, 2, 3, 4);
    document.add(root);
    expect(presenter.show(root)).toEqual(["rect#r1  parent=svg", "  x=1 y=2 width=3 height=4"]);
    expect(presenter.show(new Text("t1", 1, 2, ""))).toContain('  text=""');
  });

  it("uses current document order and supports empty roots/subtrees", () => {
    const document = new Document();
    expect(presenter.tree(document)).toEqual(["svg (800x600)"]);
    document.add(new Group("empty"));
    document.add(new Rect("r1", 0, 0, 1, 1));
    new FrontCommand(document, "empty").execute();
    expect(presenter.tree(document)).toEqual(["svg (800x600)", "├── rect#r1  x=0 y=0 w=1 h=1", "└── g#empty"]);
    expect(presenter.tree(document, "empty")).toEqual(["g#empty"]);
    expect(() => presenter.tree(document, "missing")).toThrow("no such shape: missing");
  });
});
