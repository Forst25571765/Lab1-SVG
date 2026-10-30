import type { DocumentSession } from "../application/DocumentSession.js";
import { CommandParser } from "./CommandParser.js";
import { CommandRegistry } from "./CommandRegistry.js";

export class SvgCli {
  public constructor(
    public readonly session: DocumentSession,
    private readonly parser = new CommandParser(),
    private readonly registry = new CommandRegistry(session),
  ) {}

  public run(line: string): string[] {
    try {
      const command = this.parser.parse(line);
      return command === null ? [] : this.registry.execute(command);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = raw.replace(/^(?:error:\s*)+/, "").replace(/[\r\n\u2028\u2029]/g, " ");
      return [`error: ${message || "command failed"}`];
    }
  }
}
