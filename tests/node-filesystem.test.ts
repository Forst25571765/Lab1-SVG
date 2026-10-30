import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { CreateCommand } from "../src/commands/index.js";
import { Text } from "../src/domain/index.js";
import { NodeFileSystem } from "../src/infrastructure/NodeFileSystem.js";
import { SvgReader } from "../src/infrastructure/SvgReader.js";
import { SvgWriter } from "../src/infrastructure/SvgWriter.js";

const directories: string[] = [];
function temporaryDirectory(): string {
  // The managed Windows system temp directory denies rename-over-existing operations.
  const root = fileURLToPath(new URL("../tmp/", import.meta.url));
  mkdirSync(root, { recursive: true });
  const path = mkdtempSync(join(root, "lab1-s5-"));
  directories.push(path);
  return path;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
    rmdirSync(directory);
  }
});

describe("Node filesystem adapter", () => {
  it("saves, overwrites and reads UTF-8 SVG using a real path containing spaces and Chinese", () => {
    const directory = temporaryDirectory();
    const path = join(directory, "流程图 demo.svg");
    const files = new NodeFileSystem();
    const session = new DocumentSession(files, new SvgReader(), new SvgWriter());
    session.init(400, 200);
    session.executor.execute(new CreateCommand(session.requireDocument(), new Text("t1", 10, 20, "开始 & <数据>")));
    expect(session.save(path).elementCount).toBe(1);
    session.canvas(300, 150);
    session.save(path);
    const loaded = session.read(path).document;
    expect([loaded.width, loaded.height]).toEqual([300, 150]);
    expect(loaded.requireShape("t1").getAttribute("text")).toBe("开始 & <数据>");
    expect(readdirSync(directory)).toEqual([basename(path)]);
  });

  it("maps a real missing file or parent directory to the specified errors without changing history", () => {
    const directory = temporaryDirectory();
    const session = new DocumentSession(new NodeFileSystem(), new SvgReader(), new SvgWriter());
    const document = session.init();
    session.executor.execute(new CreateCommand(document, new Text("t1", 10, 20, "text")));
    const oldUndo = session.executor.history.peekUndo();
    const missing = join(directory, "missing.svg");
    expect(() => session.read(missing)).toThrow(`cannot read file: ${missing}`);
    const target = join(directory, "absent", "out.svg");
    expect(() => session.save(target)).toThrow(`cannot write file: ${target}`);
    expect(session.currentDocument).toBe(document);
    expect(session.executor.history.peekUndo()).toBe(oldUndo);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("cleans its own temporary file after rename fails", () => {
    const directory = temporaryDirectory();
    const files = new NodeFileSystem();
    // A file cannot replace an existing directory; no platform-specific permission tricks.
    expect(() => files.writeFile(directory, "content")).toThrow();
    const prefix = `.${basename(directory)}.`;
    expect(readdirSync(dirname(directory)).filter((name) => name.startsWith(prefix))).toEqual([]);
    expect(readdirSync(directory)).toEqual([]);
  });
});
