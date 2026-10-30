import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SvgReader } from "../src/infrastructure/SvgReader.js";

interface CliPreviewCase {
  readonly key: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly elementCount: number;
  readonly sha256: string;
}

/** Generates every output through the real CLI process, then serves only the captured test assets. */
export class S6CliPreviewServer {
  private readonly assets = new Map<string, { body: string; contentType: string }>();
  private readonly cases: CliPreviewCase[] = [];
  private readonly transcripts: { name: string; input: readonly string[]; output: string }[] = [];

  public constructor(private readonly outputDirectory: string) {
    mkdirSync(outputDirectory, { recursive: true });
    this.prepare();
    const manifest = JSON.stringify({ generatedAt: new Date().toISOString(), source: "src/main.ts (real child processes)", cases: this.cases }, null, 2);
    writeFileSync(join(outputDirectory, "manifest.json"), manifest, "utf8");
    writeFileSync(join(outputDirectory, "cli-transcripts.json"), JSON.stringify(this.transcripts, null, 2), "utf8");
    this.assets.set("/manifest.json", { body: manifest, contentType: "application/json; charset=utf-8" });
    this.assets.set("/", { body: this.page(), contentType: "text/html; charset=utf-8" });
  }

  public start(port: number): Server {
    const server = createServer((request, response) => {
      if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
      const route = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (route === "/favicon.ico") { response.writeHead(204).end(); return; }
      const asset = this.assets.get(route);
      if (asset === undefined) { response.writeHead(404).end("Not found"); return; }
      response.writeHead(200, {
        "Content-Type": asset.contentType, "Content-Length": Buffer.byteLength(asset.body),
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'",
      });
      response.end(request.method === "HEAD" ? undefined : asset.body);
    });
    server.listen(port, "127.0.0.1", () => console.log(JSON.stringify({
      url: `http://127.0.0.1:${port}/`, cases: this.cases.length, outputDirectory: this.outputDirectory, pid: process.pid,
    })));
    return server;
  }

  private run(name: string, input: readonly string[]): string {
    const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
    const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), entry], {
      cwd: this.outputDirectory, input: input.join("\n") + "\n", encoding: "utf8", timeout: 10_000,
    });
    if (result.error || result.status !== 0 || result.stderr || result.stdout.includes("error:")) {
      throw new Error(`CLI fixture failed: ${name}: ${result.error?.message || result.stderr || result.stdout}`);
    }
    this.transcripts.push({ name, input, output: result.stdout });
    return result.stdout;
  }

  private capture(key: string, title: string, filename: string, expectedCount: number): void {
    const source = readFileSync(join(this.outputDirectory, filename), "utf8");
    const document = new SvgReader().read(source).document;
    if (document.size !== expectedCount) throw new Error(`Unexpected element count: ${key}`);
    this.assets.set(`/assets/${key}.svg`, { body: source, contentType: "image/svg+xml; charset=utf-8" });
    this.cases.push({ key, title, width: document.width, height: document.height, elementCount: document.size,
      sha256: createHash("sha256").update(source).digest("hex") });
  }

  private prepare(): void {
    this.run("flowchart", [
      "init 800 600", "create g flowchart", "create g node1 in flowchart",
      "create rect start 120 100 160 60 #4a90d9 in node1", 'create text start-label 155 135 "开始" in node1',
      "create g node2 in flowchart", "create rect process 520 100 160 60 #f5a623 in node2",
      'create text process-label 545 135 "处理数据" in node2', "create line arrow1 280 130 520 130 black in flowchart",
      "move node2 0 100", "undo", "redo", "undo", 'set process-label text "处理数据 v2"', "tree", "show process-label",
      'save "流程图 demo.svg"',
    ]);
    this.capture("flowchart", "CLI 创建的流程图与中文修改", "流程图 demo.svg", 8);
    this.run("roundtrip", ['read "流程图 demo.svg"', "tree", 'save "roundtrip.svg"']);
    this.capture("roundtrip", "CLI read / save 后的流程图", "roundtrip.svg", 8);
    if (this.cases[0].sha256 !== this.cases[1].sha256) throw new Error("CLI round-trip changed SVG output");

    this.run("z-order", ["init 120 120", "create rect red 0 0 80 80 red", "create rect blue 20 20 80 80 blue",
      "front red", "save front.svg", "back red", "save back.svg"]);
    this.capture("front", "CLI front red：重叠区域为红色", "front.svg", 2);
    this.capture("back", "CLI back red：重叠区域为蓝色", "back.svg", 2);

    writeFileSync(join(this.outputDirectory, "external.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160">'
      + '<rect x="20" y="20" width="100" height="60" fill="#55aa66"/>'
      + '<rect id="rect1" x="160" y="20" width="100" height="60" fill="#4a90d9"/>'
      + '<text id="title" x="20" y="120">外部 SVG 经 CLI 读入并补 ID</text></svg>', "utf8");
    const imported = this.run("imported", ["read external.svg", "tree", "save imported.svg"]);
    if (!imported.includes("warning: assigned id rect2 to unnamed <rect>\nread external.svg (3 elements)")) {
      throw new Error("CLI warning/summary order differs");
    }
    this.capture("imported", "CLI 外部导入、补 ID 与保存", "imported.svg", 3);
  }

  private page(): string {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>S6 CLI 浏览器验收</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font:16px system-ui;color:#243246;background:#f4f6f8;margin:24px}h1{font-size:24px}h2{font-size:17px;margin:0 0 8px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:1150px}section{background:white;border:1px solid #c9d0d8;border-radius:8px;padding:18px}img{display:block;max-width:100%;height:auto;width:400px;margin-bottom:12px}.order{width:120px}p,a{font-size:14px}@media(max-width:700px){main{grid-template-columns:1fr}}</style></head>
      <body><h1>S6：真实 CLI 输出的浏览器验收</h1><p>所有输出由 src/main.ts 子进程执行命令生成；保存读回文件内容一致。</p><main>
      ${this.cases.map((item) => `<section><h2>${item.title}</h2><p>${item.width}×${item.height} · ${item.elementCount} 个元素</p>
      <img data-testid="${item.key}" alt="${item.title}" src="/assets/${item.key}.svg" width="${item.width}" height="${item.height}" class="${item.key === "front" || item.key === "back" ? "order" : ""}">
      <a href="/assets/${item.key}.svg">单独打开 SVG</a></section>`).join("\n")}</main></body></html>`;
  }
}
