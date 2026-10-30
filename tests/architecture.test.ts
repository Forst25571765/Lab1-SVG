import { afterAll, describe, expect, it } from "vitest";
import { ArchitectureCheck } from "../scripts/ArchitectureCheck.js";

const check = new ArchitectureCheck();
afterAll(() => check.close());

describe("architecture guard negative fixtures", () => {
  it.each([
    ["src/domain/Example.ts", 'import { SvgCli } from "../cli/SvgCli.js";'],
    ["src/domain/Example.ts", 'export { SvgReader } from "../infrastructure/SvgReader.js";'],
    ["src/commands/Example.ts", 'type File = import("node:fs").Stats;'],
    ["src/application/Example.ts", 'const io = import("../infrastructure/NodeFileSystem.js");'],
    ["src/cli/Example.ts", 'const io = require("node:fs");'],
    ["src/application/ports/Example.ts", 'import { DocumentSession } from "../DocumentSession.js";'],
    ["src/infrastructure/Example.ts", 'import { CommandExecutor } from "../application/CommandExecutor.js";'],
    ["src/commands/Example.ts", 'import { setShapeLocation } from "../domain/internal/treeMutation.js";'],
    ["src/domain/index.ts", 'export * from "./internal/treeMutation.js";'],
    ["src/domain/Example.ts", 'import { helper } from "../../scripts/helper.js";'],
    ["src/domain/Example.ts", 'const module = import(variable);'],
  ])("rejects forbidden dependencies in %s: %s", (file, source) => {
    expect(check.inspect(file, source).length).toBeGreaterThan(0);
  });

  it.each([
    'switch (shape.kind) { case "rect": break; }',
    'if (shape.type === "circle") {}',
    'if ("line" === element.localName) {}',
    'if (shape instanceof Rect) {}',
    'import { Text as Label } from "../domain/Text.js"; if (shape instanceof Label) {}',
  ])("rejects dispersed concrete shape dispatch: %s", (source) => {
    expect(check.inspect("src/cli/Example.ts", source).some((issue) => /dispatch|polymorphism/.test(issue.message))).toBe(true);
  });

  it("detects class/file mismatches and multiple classes", () => {
    expect(check.inspect("src/domain/Example.ts", "class Example {} class Other {}")
      .map((issue) => issue.message)).toEqual(["class name must match its filename", "only one class is allowed per file"]);
  });

  it.each([
    'switch (command.name) { case "move": break; }',
    'if (commandName === "create") {}',
  ])("keeps command-name dispatch in one registry: %s", (source) => {
    expect(check.inspect("src/cli/Example.ts", source).map((issue) => issue.message))
      .toEqual(["command-name dispatch belongs in CommandRegistry"]);
    expect(check.inspect("src/cli/CommandRegistry.ts", source)).toEqual([]);
  });

  it("does not mistake comments or string values for imports", () => {
    expect(check.inspect("src/domain/Example.ts", '// import "node:fs";\nconst text = \'import("node:fs")\';')).toEqual([]);
  });

  it.each([
    ["src/domain/Example.ts", 'import type { Shape } from "./Shape.js"; export class Example {}'],
    ["src/domain/Shape.ts", 'import { setShapeLocation } from "./internal/treeMutation.js";'],
    ["src/domain/ShapeFactory.ts", 'switch (type) { case "rect": break; }'],
    ["src/cli/Example.ts", 'import { ShapeFactory } from "../domain/ShapeFactory.js";'],
    ["src/infrastructure/Example.ts", 'import type { FileSystem } from "../application/ports/FileSystem.js";'],
    ["src/domain/Example.ts", 'switch (attribute) { case "text": break; }'],
    ["src/commands/Example.ts", 'import { Group } from "../domain/Group.js"; if (shape instanceof Group) {}'],
  ])("permits the intended boundary or polymorphic contract in %s", (file, source) => {
    expect(check.inspect(file, source)).toEqual([]);
  });
});
