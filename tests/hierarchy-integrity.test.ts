import { describe, expect, it } from "vitest";

import { CommandExecutor } from "../src/application/index.js";
import {
  AddToCommand, BackCommand, CreateCommand, DeleteCommand, FrontCommand,
  GroupCommand, MoveCommand, ScaleCommand, SetCommand, UngroupCommand,
} from "../src/commands/index.js";
import { Circle, Document, Group, Rect, Shape, Text } from "../src/domain/index.js";
import { captureDocument, expectDocumentUnchanged } from "./helpers/documentState.js";

function createTree() {
  const document = new Document();
  const group = new Group("g");
  const root = new Rect("root", 10, 20, 30, 40);
  const child = new Rect("child", 1, 2, 3, 4);
  document.add(group);
  document.add(root);
  document.add(child, group);
  return { document, group, root, child };
}

describe("public hierarchy interface protection", () => {
  it.each(["add root", "insert root", "add duplicate", "insert duplicate", "remove child"] as const)(
    "rejects %s through an attached Group even when given its Document", (operation) => {
      const { document, group, root, child } = createTree();
      const duplicate = new Rect("root", 0, 0, 1, 1);
      const before = captureDocument(document);
      const attempt = () => {
        // Exercise the old bypass from a JavaScript caller, including the obsolete owner argument.
        switch (operation) {
          case "add root": return Reflect.apply(group.addChild, group, [root, document]);
          case "insert root": return Reflect.apply(group.insertChildAt, group, [root, 0, document]);
          case "add duplicate": return Reflect.apply(group.addChild, group, [duplicate, document]);
          case "insert duplicate": return Reflect.apply(group.insertChildAt, group, [duplicate, 0, document]);
          case "remove child": return Reflect.apply(group.removeChild, group, [child, document]);
        }
      };

      expect(attempt).toThrow("attached shapes must be modified through Document");

      expectDocumentUnchanged(document, before);
      expect(duplicate.parent).toBeNull();
      expect(duplicate.ownerDocument).toBeNull();
    },
  );

  it.each(["add", "insert", "remove"] as const)("rejects direct %s on an attached group", (operation) => {
    const { document, group, child } = createTree();
    const fresh = new Rect("fresh", 0, 0, 1, 1);
    const before = captureDocument(document);

    expect(() => {
      if (operation === "add") group.addChild(fresh);
      else if (operation === "insert") group.insertChildAt(fresh, 0);
      else group.removeChild(child);
    }).toThrow("attached shapes must be modified through Document");

    expectDocumentUnchanged(document, before);
    expect(fresh.parent).toBeNull();
  });

  it("exposes parent and document ownership only as read-only public properties", () => {
    const { document, group, root } = createTree();
    const before = captureDocument(document);

    expect(root).not.toHaveProperty("setParent");
    expect(root).not.toHaveProperty("setDocumentOwner");
    expect(Reflect.set(root, "parent", group)).toBe(false);
    expect(Reflect.set(root, "ownerDocument", null)).toBe(false);

    expectDocumentUnchanged(document, before);
  });

  it("does not expose writable child arrays", () => {
    const { document, group, root } = createTree();
    const before = captureDocument(document);

    (document.children as Shape[]).splice(0, 2);
    (group.children as Shape[]).push(root);

    expectDocumentUnchanged(document, before);
  });

  it("rejects cross-document attachment and removal without changing either tree", () => {
    const { document, group, child } = createTree();
    const other = new Document();
    const destination = new Group("destination");
    other.add(destination);
    const before = captureDocument(document);
    const otherBefore = captureDocument(other);

    expect(() => other.add(group, destination)).toThrow("shape already belongs to a document");
    expect(() => other.remove(child)).toThrow("no such shape: child");
    expect(() => Reflect.apply(destination.addChild, destination, [group, other])).toThrow(
      "attached shapes must be modified through Document",
    );

    expectDocumentUnchanged(document, before);
    expectDocumentUnchanged(other, otherBefore);
  });

  it("rejects same-id foreign objects in removal and reordering", () => {
    const { document, group } = createTree();
    const other = new Document();
    const foreign = new Rect("child", 90, 90, 1, 1);
    other.add(foreign);
    const before = captureDocument(document);
    const otherBefore = captureDocument(other);

    expect(() => document.remove(foreign)).toThrow("no such shape: child");
    expect(() => document.reorder(foreign, 0)).toThrow("no such shape: child");
    expect(() => document.addAt(new Rect("child", 0, 0, 1, 1), group, 0)).toThrow("id already exists: child");

    expectDocumentUnchanged(document, before);
    expectDocumentUnchanged(other, otherBefore);
  });
});

describe("detached trees and normal Document operations", () => {
  it.each(["outer", "shared"])("rejects a duplicate id %s anywhere in a detached tree", (duplicateId) => {
    const outer = new Group("outer");
    const left = new Group("left");
    const right = new Group("right");
    const existing = new Rect("shared", 0, 0, 1, 1);
    outer.addChild(left);
    outer.addChild(right);
    left.addChild(existing);
    const duplicate = new Rect(duplicateId, 2, 2, 1, 1);

    expect(() => right.addChild(duplicate)).toThrow(`id already exists: ${duplicateId}`);

    expect(outer.children).toEqual([left, right]);
    expect(left.children).toEqual([existing]);
    expect(right.children).toEqual([]);
    expect(duplicate.parent).toBeNull();
    const document = new Document();
    document.add(outer);
    captureDocument(document);
  });

  it("allows detached construction, insertion, removal and later document attachment", () => {
    const outer = new Group("outer");
    const inner = new Group("inner");
    const first = new Rect("first", 0, 0, 1, 1);
    const second = new Text("second", 1, 2, "two");
    inner.addChild(second);
    inner.insertChildAt(first, 0);
    outer.addChild(inner);
    expect(inner.removeChild(first)).toBe(0);
    expect(first.parent).toBeNull();
    expect(first.ownerDocument).toBeNull();
    inner.insertChildAt(first, 1);
    expect(inner.children).toEqual([second, first]);

    const document = new Document();
    document.add(outer);
    expect(document.size).toBe(4);
    captureDocument(document);
  });

  it("detaches and transfers a complete subtree while updating every owner", () => {
    const { document, group, child, root } = createTree();
    const inner = new Group("inner");
    document.add(inner, group);
    document.add(new Text("label", 1, 2, "label"), inner);
    const original = captureDocument(document);
    const removed = document.remove(group);
    expect(document.children).toEqual([root]);
    expect(group.parent).toBeNull();
    expect(child.parent).toBe(group);
    for (const node of group.getSubtree()) expect(node.ownerDocument).toBeNull();

    const other = new Document();
    other.add(group);
    captureDocument(other);
    const transferred = captureDocument(other);
    const remainder = captureDocument(document);
    expect(() => document.restore(removed)).toThrow("shape already belongs to a document");
    expectDocumentUnchanged(document, remainder);
    expectDocumentUnchanged(other, transferred);

    other.remove(group);
    document.restore(removed);
    expectDocumentUnchanged(document, original);
  });

  it("rejects invalid insertion positions before attaching any node", () => {
    const { document, group } = createTree();
    const fresh = new Group("fresh");
    fresh.addChild(new Text("label", 1, 2, "label"));
    const before = captureDocument(document);

    for (const parent of [null, group]) {
      for (const index of [-1, 999, 0.5, Number.NaN]) {
        expect(() => document.addAt(fresh, parent, index)).toThrow();
        expectDocumentUnchanged(document, before);
        expect(fresh.parent).toBeNull();
        for (const node of fresh.getSubtree()) expect(node.ownerDocument).toBeNull();
      }
    }
  });

  it("maintains structure, identity and ownership through mixed commands and full undo/redo", () => {
    const document = new Document();
    const executor = new CommandExecutor();
    const commands = [
      new CreateCommand(document, new Group("scene")),
      new CreateCommand(document, new Group("left"), "scene"),
      new CreateCommand(document, new Group("right"), "scene"),
      new CreateCommand(document, new Rect("a", 0.1, -0.2, 30, 40, { fill: "red" }), "left"),
      new CreateCommand(document, new Circle("b", 10, 20, 5), "left"),
      new CreateCommand(document, new Text("c", 1, 2, "hello"), "right"),
      new CreateCommand(document, new Rect("d", 3, 4, 5, 6), "right"),
      new GroupCommand(document, "cluster", ["c", "a"]),
      new MoveCommand(document, "cluster", 0.1, -0.3),
      new ScaleCommand(document, "cluster", 0.25),
      new SetCommand(document, "c", "text", "中文 & <label>"),
      new SetCommand(document, "a", "stroke-width", 1.25),
      new AddToCommand(document, "right", "b"),
      new FrontCommand(document, "d"),
      new BackCommand(document, "c"),
      new UngroupCommand(document, "cluster"),
      new AddToCommand(document, "left", "b"),
      new DeleteCommand(document, "right"),
      new DeleteCommand(document, "a"),
      new MoveCommand(document, "scene", -2, 3),
      new BackCommand(document, "scene"),
    ];
    const states = [captureDocument(document)];
    for (const command of commands) {
      executor.execute(command);
      states.push(captureDocument(document));
    }
    for (let index = commands.length - 1; index >= 0; index--) {
      executor.undo();
      expectDocumentUnchanged(document, states[index]);
    }
    for (let index = 0; index < commands.length; index++) {
      executor.redo();
      expectDocumentUnchanged(document, states[index + 1]);
    }
  });
});
