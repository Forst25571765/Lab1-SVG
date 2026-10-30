import { describe, expect, it } from "vitest";
import { CommandParser } from "../src/cli/CommandParser.js";

const parser = new CommandParser();

describe("CLI tokenization", () => {
  it.each(["", "   ", "# comment", "  # 注释"])("skips blank or comment lines: %s", (line) => {
    expect(parser.parse(line)).toBeNull();
  });

  it.each([
    ["help # 显示帮助", "help", []],
    ["init 400 200\t# 新画布 in ignored", "init", ["400", "200"]],
    ["undo #", "undo", []],
  ] as const)("ignores a trailing comment after a standalone hash: %s", (line, name, values) => {
    expect(parser.parse(line)).toEqual({ name, args: values.map((value) => ({ value, quoted: false })) });
  });

  it("ignores malformed syntax only after the comment marker", () => {
    expect(parser.parse('move r1 10 0 # "unterminated in ignored')).toEqual({
      name: "move", args: ["r1", "10", "0"].map((value) => ({ value, quoted: false })),
    });
    expect(() => parser.parse('set t1 text "unfinished # still text')).toThrow("unterminated double quote");
    expect(() => parser.parse('set t1 text "word"# comment')).toThrow("quotes must enclose a whole argument");
  });

  it("preserves quoted hashes, colors and hashes embedded in argument values before comments", () => {
    expect(parser.parse('set r1 fill #4a90d9 # blue')?.args.map((token) => token.value))
      .toEqual(["r1", "fill", "#4a90d9"]);
    expect(parser.parse('read "folder # draft/drawing.svg" # file')?.args)
      .toEqual([{ value: "folder # draft/drawing.svg", quoted: true }]);
    expect(parser.parse('read drawing#1.svg # file')?.args)
      .toEqual([{ value: "drawing#1.svg", quoted: false }]);
    expect(parser.parse('set t1 text "# heading in scene" # note')?.args.at(-1))
      .toEqual({ value: "# heading in scene", quoted: true });
    expect(parser.parse('set t1 text "#" # note')?.args.at(-1)).toEqual({ value: "#", quoted: true });
    expect(parser.parse('help #note')?.args).toEqual([{ value: "#note", quoted: false }]);
  });

  it("keeps colors and hashes inside arguments", () => {
    const command = parser.parse('create rect r1 1 2 3 4 #4a90d9 in scene');
    expect(command?.name).toBe("create");
    expect(command?.args.map((token) => token.value)).toEqual(["rect", "r1", "1", "2", "3", "4", "#4a90d9", "in", "scene"]);
    expect(command?.args.every((token) => !token.quoted)).toBe(true);
    expect(parser.parse('set title text "# heading in node1"')?.args.at(-1))
      .toEqual({ value: "# heading in node1", quoted: true });
  });

  it("preserves quoted whitespace, empty text and a literal in token", () => {
    expect(parser.parse('create text t1 20 40 "  My Diagram  "')?.args.at(-1))
      .toEqual({ value: "  My Diagram  ", quoted: true });
    expect(parser.parse('set t1 text ""')?.args.at(-1)).toEqual({ value: "", quoted: true });
    expect(parser.parse('create text t1 0 0 "in"')?.args.at(-1)).toEqual({ value: "in", quoted: true });
  });

  it("supports escaped quotes/backslashes while preserving Windows paths and literal escape-like text", () => {
    expect(parser.parse(String.raw`read "C:\new folder\绘图.svg"`)?.args[0]?.value)
      .toBe(String.raw`C:\new folder\绘图.svg`);
    expect(parser.parse(String.raw`set t1 text "say \"hello\" \\ path\name"`)?.args.at(-1)?.value)
      .toBe(String.raw`say "hello" \ path\name`);
  });

  it.each([
    ['set t1 text "unterminated', "unterminated double quote"],
    ['set t1 text ab"cd"', "quotes must enclose a whole argument"],
    ['set t1 text "ab"cd', "quotes must enclose a whole argument"],
    ['"help"', "command name must not be quoted"],
  ])("rejects malformed quoting: %s", (line, error) => {
    expect(() => parser.parse(line)).toThrow(error);
  });
});
