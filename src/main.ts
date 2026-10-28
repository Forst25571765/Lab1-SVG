import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export interface ReplOptions {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

/**
 * Start the minimal Lab1 command-line loop.
 * Command parsing and business behavior will be added in later steps.
 */
export function startRepl(
  options: Partial<ReplOptions> = {}
): ReturnType<typeof createInterface> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const repl = createInterface({ input, output });

  repl.setPrompt("svg> ");
  repl.prompt();

  repl.on("line", (line) => {
    const commandLine = line.trim();

    if (commandLine.length > 0 && !commandLine.startsWith("#")) {
      output.write(`error: command not implemented: ${commandLine}\n`);
    }

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

