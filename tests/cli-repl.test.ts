import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { SvgCli } from "../src/cli/SvgCli.js";
import { SvgReader, SvgWriter } from "../src/infrastructure/index.js";
import { startRepl } from "../src/main.js";
import { MemoryFileSystem } from "./helpers/MemoryFileSystem.js";

const repository = fileURLToPath(new URL("../", import.meta.url));
const entry = join(repository, "src", "main.ts");
const nodeArguments = ["--import", import.meta.resolve("tsx"), entry];
const directories: string[] = [];

function workspace(): string {
  const root = join(repository, "tmp");
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, "s6-cli-test-"));
  directories.push(directory);
  return directory;
}

function transcript(lines: readonly string[], cwd: string): string {
  const result = spawnSync(process.execPath, nodeArguments, {
    input: lines.join("\n") + "\n", cwd, encoding: "utf8", timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  return result.stdout;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});

describe("real CLI and REPL", () => {
  it("reuses one injectable session, keeps prompts after errors, and closes on EOF", async () => {
    const input = new PassThrough(), output = new PassThrough();
    let text = "";
    output.on("data", (data) => { text += data.toString(); });
    const session = new DocumentSession(new MemoryFileSystem(), new SvgReader(), new SvgWriter());
    const repl = startRepl({ input, output, editor: new SvgCli(session), showBanner: false });
    const closed = new Promise<void>((resolve) => repl.once("close", resolve));
    input.end('  # comment\n\ninit\nunknown\ncreate text t1 0 0 "a b"\nshow t1\n');
    await closed;
    expect(text).toContain("error: unknown command: unknown\nsvg> text#t1 created");
    expect(text).toContain('  text="a b"');
    expect(text.match(/svg> /g)).toHaveLength(7);
    expect(session.requireDocument().size).toBe(1);
  });

  it("runs commented commands through the real CLI and preserves hashes in saved SVG and filenames", () => {
    const directory = workspace();
    const output = transcript([
      "#comment without a space", "init 400 200 # canvas", "create g scene # group",
      "create rect r1 10 20 30 40 #4a90d9 in scene # blue",
      'create text t1 50 60 "标题 #1" in scene # label',
      'move r1 5 0 # "unterminated', "undo # rollback", "redo # trailing-comment-only",
      'tree # "ignored', 'save "drawing #1.svg" # output',
    ], directory);
    expect(output).not.toContain("error:");
    expect(output).not.toContain("trailing-comment-only");
    expect(output).toContain("rect#r1 moved to (15,20)");
    expect(output).toContain("saved to drawing #1.svg (3 elements)");
    const document = new SvgReader().read(readFileSync(join(directory, "drawing #1.svg"), "utf8")).document;
    expect(document.size).toBe(3);
    expect(document.requireShape("r1").fill).toBe("#4a90d9");
    expect(document.requireShape("r1").getAttribute("x")).toBe(15);
    expect(document.requireShape("t1").getAttribute("text")).toBe("标题 #1");
    expect(document.requireContainer("scene").children.map((shape) => shape.id)).toEqual(["r1", "t1"]);
  });

  it("runs the original typical session with real SVG save/read and warning output", () => {
    const directory = workspace();
    writeFileSync(join(directory, "other.svg"), `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
      <text id="t1" x="10" y="290">imported</text><circle id="c1" cx="50" cy="50" r="10"/>
      <g id="g1"><rect id="r2" x="0" y="0" width="10" height="10"/><circle id="c2" cx="5" cy="5" r="2"/></g>
      <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/></svg>`, "utf8");
    const output = transcript([
      "init 800 600", "create rect bg 0 0 800 600 #ffffff", 'create text title 20 40 "My Diagram"',
      "create circle c1 100 100 20 red", "create rect box 200 80 60 60 #3366ff", "group markers c1 box", "tree",
      "move c1 30 0", "undo", "redo", 'set title text "My Diagram v2"', "undo", "group bad c1 markers",
      "delete box", "undo", "save demo.svg", "undo", "read other.svg", "tree",
    ], directory);
    expect(output).toContain("svg-editor 0.1");
    expect(output).toContain("circle#c1 moved to (130,100)");
    expect(output).toContain("circle#c1 moved back to (100,100)");
    expect(output).toContain('text#title updated: text="My Diagram"');
    expect(output).toContain("error: cannot group a container into its own descendant: markers");
    expect(output).toContain("rect#box restored into g#markers");
    expect(output).toContain("saved to demo.svg (5 elements)");
    expect(output).toContain("error: undo not allowed after io command");
    expect(output).toContain("warning: assigned id rect1 to unnamed <rect>\nread other.svg (7 elements)");
    expect(output).toContain("svg (400x300)");
    expect(output.match(/error: /g)).toHaveLength(2);
    const document = new SvgReader().read(readFileSync(join(directory, "demo.svg"), "utf8")).document;
    expect(document.size).toBe(5);
    expect(document.requireShape("c1").getAttribute("cx")).toBe(130);
    expect(document.requireShape("title").getAttribute("text")).toBe("My Diagram");
    expect(document.requireShape("box").parent?.id).toBe("markers");
  });

  it("runs the complete flowchart session and checks the actual CLI output file", () => {
    const directory = workspace();
    const output = transcript([
      "init 800 600", "create g flowchart", "create g node1 in flowchart",
      "create rect start 120 100 160 60 #4a90d9 in node1", 'create text start-label 155 135 "开始" in node1',
      "create g node2 in flowchart", "create rect process 520 100 160 60 #f5a623 in node2",
      'create text process-label 545 135 "处理数据" in node2', "create line arrow1 280 130 520 130 black in flowchart",
      "tree", "move node2 0 100", "undo", "redo", "undo", 'set process-label text "处理数据 v2"',
      'save "流程图 demo.svg"', "undo", 'read "流程图 demo.svg"', "show process-label",
    ], directory);
    expect(output).toContain("g#node2 moved by (0,100)");
    expect(output).toContain("g#node2 moved back by (0,-100)");
    expect(output).toContain("saved to 流程图 demo.svg (8 elements)");
    expect(output.match(/error: /g)).toHaveLength(1);
    const document = new SvgReader().read(readFileSync(join(directory, "流程图 demo.svg"), "utf8")).document;
    expect(document.size).toBe(8);
    expect(document.requireShape("process").getAttribute("y")).toBe(100);
    expect(document.requireShape("process-label").getAttribute("text")).toBe("处理数据 v2");
    expect(document.requireContainer("flowchart").children.map((shape) => shape.id)).toEqual(["node1", "node2", "arrow1"]);
  });

  it("executes the remaining display, hierarchy and document routes in a real process", () => {
    const directory = workspace();
    const output = transcript([
      "help", "init 400 200", "canvas", "create g scene", "create g inner in scene",
      "create rect r1 1 2 3 4 in inner", "create circle c1 10 20 5 in scene", "ungroup inner",
      "create g other in scene", "addto other r1", "undo", "front r1", "back r1", "scale r1 2",
      "create ellipse e1 10 20 3 4", "show r1", "canvas 500 250", "delete e1", "undo", "tree scene", "save all.svg",
    ], directory);
    expect(output).not.toContain("error:");
    expect(output).toContain("canvas resized to 500x250");
    expect(output).toContain("rect#r1  parent=g#scene");
    const document = new SvgReader().read(readFileSync(join(directory, "all.svg"), "utf8")).document;
    expect([document.width, document.height]).toEqual([500, 250]);
    expect(document.requireShape("r1").getAttribute("width")).toBe(6);
    expect(document.requireShape("e1")).toBeDefined();
  });

  it("keeps running while waiting for subsequent interactive input", async () => {
    const child = spawn(process.execPath, nodeArguments, { cwd: repository, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", errors = "";
    child.stdout.on("data", (data) => { output += data.toString(); });
    child.stderr.on("data", (data) => { errors += data.toString(); });
    const waitFor = (pattern: RegExp) => new Promise<void>((resolve, reject) => {
      if (pattern.test(output)) return resolve();
      const timer = setTimeout(() => { child.stdout.off("data", inspect); reject(new Error(`Missing output: ${pattern}`)); }, 5_000);
      const inspect = () => {
        if (pattern.test(output)) { clearTimeout(timer); child.stdout.off("data", inspect); resolve(); }
      };
      child.stdout.on("data", inspect);
    });
    const exit = new Promise<number | null>((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
    try {
      await waitFor(/svg> /);
      expect(child.exitCode).toBeNull();
      child.stdin.write("unknown\ninit 320 240\n");
      await waitFor(/canvas 320x240 created\nsvg> /);
      expect(child.exitCode).toBeNull();
      child.stdin.end();
      expect(await exit).toBe(0);
      expect(errors).toBe("");
      expect(output).toContain("error: unknown command: unknown");
    } finally {
      if (child.exitCode === null) child.kill();
    }
  }, 10_000);

  it("does not start a REPL when main is imported", () => {
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e",
      `await import(${JSON.stringify(pathToFileURL(entry).href)}); console.log('imported');`],
    { cwd: repository, encoding: "utf8", timeout: 5_000 });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("imported");
    expect(result.stderr).toBe("");
  });
});
