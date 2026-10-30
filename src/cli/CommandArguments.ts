import { CliError } from "./CliError.js";
import type { CommandToken } from "./CommandParser.js";

export class CommandArguments {
  public constructor(
    public readonly tokens: readonly CommandToken[],
    private readonly syntax: string,
  ) {}

  public get length(): number { return this.tokens.length; }

  public count(min: number, max = min): void {
    if (this.length < min || this.length > max) this.usage();
  }

  public usage(): never { throw new CliError(`usage: ${this.syntax}`); }

  public value(index: number): string {
    const token = this.tokens[index];
    if (token === undefined) this.usage();
    return token.value;
  }

  public number(index: number, name: string): number {
    const value = this.value(index);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) {
      throw new CliError(`invalid number for ${name}`);
    }
    return Number(value);
  }

  public text(index: number, name: string, quoted = false): string {
    const value = this.value(index);
    if (quoted && !this.tokens[index].quoted) throw new CliError(`${name} must be double-quoted`);
    return value;
  }

  public splitContainer(): { args: CommandArguments; parent?: string } {
    const keyword = this.tokens.at(-2);
    if (keyword?.value === "in" && !keyword.quoted) {
      const parent = this.value(this.length - 1);
      if (parent.trim().length === 0) this.usage();
      return { args: new CommandArguments(this.tokens.slice(0, -2), this.syntax), parent };
    }
    const last = this.tokens.at(-1);
    if (this.length > 2 && last?.value === "in" && !last.quoted) this.usage();
    return { args: this };
  }
}
