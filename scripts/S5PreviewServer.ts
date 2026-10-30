import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { DocumentSession } from "../src/application/DocumentSession.js";
import { BackCommand, CreateCommand, FrontCommand } from "../src/commands/index.js";
import { ShapeFactory, type Document, type ShapeSpec } from "../src/domain/index.js";
import { NodeFileSystem, SvgReader, SvgWriter } from "../src/infrastructure/index.js";

interface PreviewCase {
  readonly key: string;
  readonly title: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly elementCount: number;
  readonly sha256: string;
  readonly warnings: readonly string[];
}

interface Asset {
  readonly contentType: string;
  readonly body: string;
}

/** A loopback-only test app with fixed generated assets, never a filesystem/proxy server. */
export class S5PreviewServer {
  private readonly files = new NodeFileSystem();
  private readonly session = new DocumentSession(this.files, new SvgReader(), new SvgWriter());
  private readonly assets = new Map<string, Asset>();
  private readonly cases: PreviewCase[] = [];
  private roundTripEqual = false;

  public constructor(private readonly outputDirectory: string) {
    mkdirSync(outputDirectory, { recursive: true });
    this.prepareFixtures();
    const manifest = JSON.stringify({
      generatedAt: new Date().toISOString(),
      roundTripEqual: this.roundTripEqual,
      cases: this.cases,
    }, null, 2);
    writeFileSync(join(outputDirectory, "manifest.json"), manifest, "utf8");
    this.assets.set("/manifest.json", { contentType: "application/json; charset=utf-8", body: manifest });
    const page = { contentType: "text/html; charset=utf-8", body: this.page() };
    this.assets.set("/", page);
    this.assets.set("/index.html", page);
    this.assets.set("/health", { contentType: "application/json; charset=utf-8", body: '{"status":"ok"}' });
  }

  public start(port: number): Server {
    const server = createServer((request, response) => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" }).end();
        return;
      }
      const route = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (route === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      const asset = this.assets.get(route);
      if (asset === undefined) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": asset.contentType,
        "Content-Length": Buffer.byteLength(asset.body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'",
      });
      response.end(request.method === "HEAD" ? undefined : asset.body);
    });
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("Expected a TCP address");
      console.log(JSON.stringify({
        url: `http://127.0.0.1:${address.port}/`,
        cases: this.cases.length,
        roundTripEqual: this.roundTripEqual,
        outputDirectory: this.outputDirectory,
        pid: process.pid,
      }));
    });
    return server;
  }

  private create(spec: ShapeSpec, parent?: string): void {
    this.session.executor.execute(new CreateCommand(this.session.requireDocument(), ShapeFactory.create(spec), parent));
  }

  private saveCase(key: string, title: string, expectedCount: number, warnings: readonly string[] = []): void {
    const path = join(this.outputDirectory, `${key}.svg`);
    const result = this.session.save(path);
    if (result.elementCount !== expectedCount) throw new Error(`Wrong element count for ${key}`);
    const document = this.session.requireDocument();
    const source = this.files.readFile(path);
    const route = `/assets/${key}.svg`;
    this.assets.set(route, { contentType: "image/svg+xml; charset=utf-8", body: source });
    this.cases.push({
      key, title, path: route, width: document.width, height: document.height,
      elementCount: result.elementCount,
      sha256: createHash("sha256").update(source).digest("hex"),
      warnings,
    });
  }

  private snapshot(document: Document): string {
    return JSON.stringify({
      width: document.width, height: document.height,
      shapes: document.children.flatMap((root) => root.getSubtree()).map((shape) => ({
        id: shape.id, kind: shape.kind, parent: shape.parent?.id ?? null,
        attributes: shape.getAttributes(), children: shape.children.map((child) => child.id),
      })),
    });
  }

  private prepareFixtures(): void {
    this.session.init();
    this.create({ type: "g", id: "flowchart" });
    this.create({ type: "g", id: "node1" }, "flowchart");
    this.create({ type: "rect", id: "start", x: 120, y: 100, width: 160, height: 60, fill: "#4a90d9" }, "node1");
    this.create({ type: "text", id: "start-label", x: 155, y: 135, text: "开始" }, "node1");
    this.create({ type: "g", id: "node2" }, "flowchart");
    this.create({ type: "rect", id: "process", x: 520, y: 100, width: 160, height: 60, fill: "#f5a623" }, "node2");
    this.create({ type: "text", id: "process-label", x: 545, y: 135, text: "处理数据" }, "node2");
    this.create({ type: "line", id: "arrow1", x1: 280, y1: 130, x2: 520, y2: 130, stroke: "black" }, "flowchart");
    const before = this.snapshot(this.session.requireDocument());
    this.saveCase("flowchart", "两节点流程图", 8);
    this.session.read(join(this.outputDirectory, "flowchart.svg"));
    this.roundTripEqual = before === this.snapshot(this.session.requireDocument());
    if (!this.roundTripEqual) throw new Error("Flowchart changed during save/read");
    this.saveCase("roundtrip", "保存后读回再保存", 8);

    this.session.init(400, 240);
    this.create({ type: "g", id: "scene", fill: "#dddddd" });
    this.create({ type: "rect", id: "r1", x: 20, y: 20, width: 80, height: 50, fill: "#f5a623" }, "scene");
    this.create({ type: "circle", id: "c1", cx: 160, cy: 45, r: 25, fill: "#4a90d9" }, "scene");
    this.create({ type: "ellipse", id: "e1", cx: 270, cy: 45, rx: 50, ry: 25, fill: "#55aa66" }, "scene");
    this.create({ type: "line", id: "l1", x1: 20, y1: 110, x2: 340, y2: 110, stroke: "#333333" }, "scene");
    this.create({ type: "text", id: "t1", x: 20, y: 155, text: '中文 & <标记> "引号"', fill: "#111111" }, "scene");
    this.create({ type: "g", id: "nested" }, "scene");
    this.create({ type: "rect", id: "child", x: 20, y: 180, width: 80, height: 35 }, "nested");
    this.saveCase("six-types", "六种类型、嵌套样式与特殊文字", 8);

    this.session.init(120, 120);
    this.create({ type: "rect", id: "red", x: 0, y: 0, width: 80, height: 80, fill: "red" });
    this.create({ type: "rect", id: "blue", x: 20, y: 20, width: 80, height: 80, fill: "blue" });
    this.session.executor.execute(new FrontCommand(this.session.requireDocument(), "red"));
    this.saveCase("front", "front red：重叠区域应为红色", 2);
    this.session.executor.execute(new BackCommand(this.session.requireDocument(), "red"));
    this.saveCase("back", "back red：重叠区域应为蓝色", 2);

    const externalPath = join(this.outputDirectory, "external-input.svg");
    this.files.writeFile(externalPath, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160">'
      + '<rect x="20" y="20" width="100" height="60" fill="#55aa66"/>'
      + '<rect id="rect1" x="160" y="20" width="100" height="60" fill="#4a90d9"/>'
      + '<text id="label" x="20" y="120">缺失 ID 自动分配为 rect2</text></svg>');
    const imported = this.session.read(externalPath);
    if (JSON.stringify(imported.warnings) !== JSON.stringify(["warning: assigned id rect2 to unnamed <rect>"])) {
      throw new Error("Unexpected missing-ID warning");
    }
    this.saveCase("missing-id", "外部 SVG 缺失 ID 与后文冲突避让", 3, imported.warnings);
  }

  private page(): string {
    const cards = this.cases.map((item) => `<section data-case="${item.key}">
      <h2>${item.title}</h2><p>${item.width}×${item.height} · ${item.elementCount} 个元素</p>
      <img data-testid="${item.key}" src="${item.path}" alt="${item.title}"
        width="${item.width}" height="${item.height}" class="${item.key === "front" || item.key === "back" ? "order" : "drawing"}">
      <a href="${item.path}">单独打开 SVG</a>
      ${item.warnings.map((warning) => `<pre>${warning.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>`).join("")}
    </section>`).join("\n");
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1"><title>S5 HTTP 浏览器验收</title>
      <style>body{font:16px system-ui;color:#243246;margin:24px;background:#f4f6f8}h1{font-size:25px;margin:0 0 8px}h2{font-size:17px;margin:0 0 8px}p{margin:0 0 12px;font-size:14px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:1150px}section{background:white;border:1px solid #c9d0d8;border-radius:8px;padding:18px}img{display:block;max-width:100%;height:auto;margin-bottom:12px}.drawing{width:400px}.order{width:120px}a{font-size:13px}pre{font:12px system-ui;white-space:pre-wrap}header{margin-bottom:20px}@media(max-width:700px){main{grid-template-columns:1fr}}</style>
      </head><body><header><h1>S5 HTTP 浏览器验收</h1><p>本机生成的独立测试样例 · 保存读回一致性：通过</p></header>
      <main>${cards}</main></body></html>`;
  }
}
