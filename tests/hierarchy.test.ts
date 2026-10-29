import { describe, expect, it } from "vitest";

import { CommandExecutor } from "../src/application/index.js";
import {
  AddToCommand,
  BackCommand,
  FrontCommand,
  GroupCommand,
  UngroupCommand,
} from "../src/commands/index.js";
import { Document, Group, Rect, Text } from "../src/domain/index.js";

function createExecutor(): CommandExecutor {
  return new CommandExecutor();
}

describe("hierarchy commands", () => {
  it("groups root-level shapes and restores them as one undo unit", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 10, 10);
    const text = new Text("t1", 10, 10, "node");

    document.add(rect);
    document.add(text);

    executor.execute(new GroupCommand(document, "g1", ["r1", "t1"]));
    const group = document.findById("g1");
    expect(group).toBeInstanceOf(Group);
    expect(document.children).toEqual([group]);
    expect((group as Group).children).toEqual([rect, text]);

    executor.undo();
    expect(document.children).toEqual([rect, text]);
    expect(document.findById("g1")).toBeUndefined();

    executor.redo();
    expect(document.children).toEqual([group]);
    expect((group as Group).children).toEqual([rect, text]);
  });

  it("groups targets from different parents while preserving their order", () => {
    const document = new Document();
    const executor = createExecutor();
    const firstGroup = new Group("g1");
    const secondGroup = new Group("g2");
    const first = new Rect("first", 0, 0, 1, 1);
    const selected = new Rect("selected", 1, 1, 1, 1);
    const otherSelected = new Text("other-selected", 2, 2, "selected");

    document.add(firstGroup);
    document.add(secondGroup);
    document.add(first, "g1");
    document.add(selected, "g1");
    document.add(otherSelected, "g2");

    executor.execute(
      new GroupCommand(document, "cluster", ["selected", "other-selected"]),
    );

    const cluster = document.findById("cluster");
    expect(cluster).toBeInstanceOf(Group);
    expect(firstGroup.children).toEqual([first, cluster]);
    expect(secondGroup.children).toHaveLength(0);
    expect((cluster as Group).children).toEqual([selected, otherSelected]);

    executor.undo();
    expect(firstGroup.children).toEqual([first, selected]);
    expect(secondGroup.children).toEqual([otherSelected]);
  });

  it("rejects grouping a container with one of its descendants atomically", () => {
    const document = new Document();
    const executor = createExecutor();
    const outer = new Group("outer");
    const inner = new Group("inner");
    const rect = new Rect("r1", 0, 0, 1, 1);

    document.add(outer);
    document.add(inner, "outer");
    document.add(rect, "inner");

    expect(() => executor.execute(new GroupCommand(document, "g1", ["outer", "inner"]))).toThrow(
      "cannot group a container into its own descendant: outer",
    );
    expect(document.children).toEqual([outer]);
    expect(outer.children).toEqual([inner]);
    expect(inner.children).toEqual([rect]);
    expect(executor.history.undoCount).toBe(0);
  });

  it("restores sibling indices when targets are interleaved across nested containers", () => {
    const document = new Document();
    const executor = createExecutor();
    const scene = new Group("scene");
    const left = new Group("left");
    const first = new Rect("first", 0, 0, 1, 1);
    const right = new Group("right");
    const last = new Rect("last", 1, 1, 1, 1);
    const tail = new Rect("tail", 2, 2, 1, 1);
    const leftChild = new Rect("left-child", 3, 3, 1, 1);
    const rightChild = new Rect("right-child", 4, 4, 1, 1);

    document.add(scene);
    for (const child of [left, first, right, last, tail]) {
      document.add(child, scene);
    }
    document.add(leftChild, left);
    document.add(rightChild, right);

    executor.execute(
      new GroupCommand(document, "cluster", [last, rightChild, first, leftChild]),
    );
    const cluster = document.requireContainer("cluster");
    expect(scene.children).toEqual([left, right, tail]);
    expect(left.children).toEqual([cluster]);
    expect(cluster.children).toEqual([leftChild, first, rightChild, last]);

    executor.undo();
    expect(scene.children).toEqual([left, first, right, last, tail]);
    expect(left.children).toEqual([leftChild]);
    expect(right.children).toEqual([rightChild]);
    expect(document.findById("cluster")).toBeUndefined();
    expect(first.parent).toBe(scene);
    expect(last.parent).toBe(scene);
    expect(leftChild.ownerDocument).toBe(document);
    expect(rightChild.ownerDocument).toBe(document);

    executor.redo();
    expect(cluster.children).toEqual([leftChild, first, rightChild, last]);
    executor.undo();
    expect(scene.children).toEqual([left, first, right, last, tail]);
  });

  it("ungroups a nested container in its original position", () => {
    const document = new Document();
    const executor = createExecutor();
    const scene = new Group("scene");
    const before = new Rect("before", 0, 0, 1, 1);
    const node = new Group("node");
    const rect = new Rect("r1", 1, 1, 1, 1);
    const text = new Text("t1", 2, 2, "node");
    const after = new Rect("after", 3, 3, 1, 1);

    document.add(scene);
    document.add(before, "scene");
    document.add(node, "scene");
    document.add(rect, "node");
    document.add(text, "node");
    document.add(after, "scene");

    executor.execute(new UngroupCommand(document, "node"));
    expect(scene.children).toEqual([before, rect, text, after]);
    expect(document.findById("node")).toBeUndefined();

    executor.undo();
    expect(scene.children).toEqual([before, node, after]);
    expect(node.children).toEqual([rect, text]);

    executor.redo();
    expect(scene.children).toEqual([before, rect, text, after]);
  });

  it("rejects ungrouping a top-level container", () => {
    const document = new Document();
    const executor = createExecutor();
    const scene = new Group("scene");

    document.add(scene);

    expect(() => executor.execute(new UngroupCommand(document, "scene"))).toThrow(
      "cannot ungroup top-level container: scene",
    );
    expect(document.children).toEqual([scene]);
    expect(executor.history.undoCount).toBe(0);
  });

  it("moves an object into a group as the last child and restores its parent", () => {
    const document = new Document();
    const executor = createExecutor();
    const firstGroup = new Group("g1");
    const secondGroup = new Group("g2");
    const first = new Rect("first", 0, 0, 1, 1);
    const moved = new Text("moved", 1, 1, "moved");

    document.add(firstGroup);
    document.add(secondGroup);
    document.add(first, "g1");
    document.add(moved, "g2");

    executor.execute(new AddToCommand(document, "g1", "moved"));
    expect(firstGroup.children).toEqual([first, moved]);
    expect(secondGroup.children).toHaveLength(0);

    executor.undo();
    expect(firstGroup.children).toEqual([first]);
    expect(secondGroup.children).toEqual([moved]);

    executor.redo();
    expect(firstGroup.children).toEqual([first, moved]);
  });

  it("rejects moving a container into its own descendant", () => {
    const document = new Document();
    const executor = createExecutor();
    const outer = new Group("outer");
    const inner = new Group("inner");

    document.add(outer);
    document.add(inner, "outer");

    expect(() => executor.execute(new AddToCommand(document, "inner", "outer"))).toThrow(
      "cannot move a container into its own descendant: outer",
    );
    expect(outer.children).toEqual([inner]);
    expect(executor.history.undoCount).toBe(0);
  });

  it("moves an object to the front of its siblings and restores its order", () => {
    const document = new Document();
    const executor = createExecutor();
    const group = new Group("g1");
    const first = new Rect("first", 0, 0, 1, 1);
    const middle = new Rect("middle", 1, 1, 1, 1);
    const last = new Text("last", 2, 2, "last");

    document.add(group);
    document.add(first, "g1");
    document.add(middle, "g1");
    document.add(last, "g1");

    executor.execute(new FrontCommand(document, "last"));
    expect(group.children).toEqual([last, first, middle]);

    executor.undo();
    expect(group.children).toEqual([first, middle, last]);

    executor.redo();
    expect(group.children).toEqual([last, first, middle]);
  });

  it("moves an object to the back of its siblings and restores its order", () => {
    const document = new Document();
    const executor = createExecutor();
    const group = new Group("g1");
    const first = new Rect("first", 0, 0, 1, 1);
    const middle = new Rect("middle", 1, 1, 1, 1);
    const last = new Text("last", 2, 2, "last");

    document.add(group);
    document.add(first, "g1");
    document.add(middle, "g1");
    document.add(last, "g1");

    executor.execute(new BackCommand(document, "first"));
    expect(group.children).toEqual([middle, last, first]);

    executor.undo();
    expect(group.children).toEqual([first, middle, last]);

    executor.redo();
    expect(group.children).toEqual([middle, last, first]);
  });

  it.each(["root", "nested"] as const)(
    "rejects an out-of-range z-order index without changing the %s tree",
    (location) => {
      const document = new Document();
      const group = new Group("g1");
      const first = new Rect("first", 0, 0, 1, 1);
      const last = new Rect("last", 1, 1, 1, 1);
      const parent = location === "root" ? null : group;
      if (parent !== null) {
        document.add(parent);
      }
      document.add(first, parent);
      document.add(last, parent);

      for (const index of [-1, 2, 0.5, Number.NaN]) {
        expect(() => document.reorder(first, index)).toThrow(
          "sibling index is out of range",
        );
        expect(parent === null ? document.children : parent.children).toEqual([first, last]);
        expect(first.parent).toBe(parent);
        expect(first.ownerDocument).toBe(document);
        expect(document.findById("first")).toBe(first);
      }
    },
  );

  it("keeps the tree unchanged when grouping uses an existing id", () => {
    const document = new Document();
    const executor = createExecutor();
    const rect = new Rect("r1", 0, 0, 1, 1);

    document.add(rect);

    expect(() => executor.execute(new GroupCommand(document, "r1", ["r1"]))).toThrow(
      "id already exists: r1",
    );
    expect(document.children).toEqual([rect]);
    expect(executor.history.undoCount).toBe(0);
  });
});
