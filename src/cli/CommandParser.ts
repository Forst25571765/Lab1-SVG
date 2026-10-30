import { CliError } from "./CliError.js";

export interface CommandToken {
  readonly value: string;
  readonly quoted: boolean;
}

export interface ParsedCommand {
  readonly name: string;
  readonly args: readonly CommandToken[];
}

export class CommandParser {
  public parse(line: string): ParsedCommand | null {
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) return null;
    const tokens: CommandToken[] = [];
    let index = 0;
    while (index < line.length) {
      while (index < line.length && /\s/.test(line[index])) index++;
      if (index === line.length) break;
      // A standalone hash starts a comment; colors and hashes inside tokens remain arguments.
      if (line[index] === "#" && (index + 1 === line.length || /\s/.test(line[index + 1]))) break;
      const quoted = line[index] === '"';
      let value = "";
      if (quoted) {
        index++;
        while (index < line.length && line[index] !== '"') {
          const next = line[index + 1];
          if (line[index] === "\\" && (next === '"' || next === "\\")) {
            value += next;
            index += 2;
          } else {
            value += line[index++];
          }
        }
        if (index === line.length) throw new CliError("unterminated double quote");
        index++;
        if (index < line.length && !/\s/.test(line[index])) {
          throw new CliError("quotes must enclose a whole argument");
        }
      } else {
        while (index < line.length && !/\s/.test(line[index])) {
          if (line[index] === '"') throw new CliError("quotes must enclose a whole argument");
          value += line[index++];
        }
      }
      tokens.push({ value, quoted });
    }
    const [name, ...args] = tokens;
    if (name.quoted) throw new CliError("command name must not be quoted");
    return { name: name.value, args };
  }
}
