import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { DocumentSession } from "./application/DocumentSession.js";
import { SvgCli } from "./cli/SvgCli.js";
import { NodeFileSystem, SvgReader, SvgWriter } from "./infrastructure/index.js";

export interface ReplOptions {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  editor: SvgCli;
  showBanner: boolean;
}

/** Composition root and synchronous REPL; one session owns all document and history operations. */
export function startRepl(
  options: Partial<ReplOptions> = {}
): ReturnType<typeof createInterface> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const editor = options.editor ?? new SvgCli(new DocumentSession(new NodeFileSystem(), new SvgReader(), new SvgWriter()));
  const repl = createInterface({ input, output });

  if (options.showBanner !== false) output.write("svg-editor 0.1 — type 'help' for commands\n\n");
  repl.setPrompt("svg> ");
  repl.prompt();

  repl.on("line", (line) => {
    for (const message of editor.run(line)) output.write(`${message}\n`);

    repl.prompt();
  });

  return repl;
}

export function main(): void {
  startRepl();
}

const currentFile = process.argv[1];
if (currentFile && import.meta.url === pathToFileURL(currentFile).href) {
  main();
}

