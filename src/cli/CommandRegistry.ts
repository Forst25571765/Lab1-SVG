import type { DocumentSession } from "../application/DocumentSession.js";
import {
  AddToCommand, BackCommand, CreateCommand, DeleteCommand, FrontCommand, GroupCommand,
  MoveCommand, ScaleCommand, SetCommand, UngroupCommand, type Command,
} from "../commands/index.js";
import { ShapeFactory, type Shape } from "../domain/index.js";
import { unknownAttribute } from "../domain/errors.js";
import { CliError } from "./CliError.js";
import { CommandArguments } from "./CommandArguments.js";
import type { ParsedCommand } from "./CommandParser.js";
import { ShapePresenter } from "./ShapePresenter.js";

interface EditFeedback {
  readonly execute: () => string;
  readonly undo: () => string;
}

interface CommandEntry {
  readonly syntax: string;
  readonly run: (args: CommandArguments) => string[];
}

/** The only command-name dispatch point; all mutations go through existing application APIs. */
export class CommandRegistry {
  private readonly entries = new Map<string, CommandEntry>();
  private readonly feedback = new WeakMap<Command, EditFeedback>();

  public constructor(
    private readonly session: DocumentSession,
    private readonly presenter = new ShapePresenter(),
  ) {
    this.registerDocumentCommands();
    this.registerEditingCommands();
    this.registerQueryCommands();
    this.registerHistoryCommands();
  }

  private registerDocumentCommands(): void {
    const session = this.session;
    this.register("init", "init [w h]", (args) => {
      if (args.length !== 0 && args.length !== 2) args.usage();
      const document = args.length === 0
        ? session.init() : session.init(args.number(0, "width"), args.number(1, "height"));
      return [`canvas ${document.width}x${document.height} created`];
    });
    this.register("read", "read <file.svg>", (args) => {
      args.count(1);
      const result = session.read(args.value(0));
      return [...result.warnings, `read ${result.path} (${result.elementCount} elements)`];
    });
    this.register("save", "save [file.svg]", (args) => {
      args.count(0, 1);
      const result = session.save(args.length ? args.value(0) : undefined);
      return [`saved to ${result.path} (${result.elementCount} elements)`];
    });
    this.register("canvas", "canvas [w h]", (args) => {
      if (args.length !== 0 && args.length !== 2) args.usage();
      const size = args.length === 0 ? session.canvas() : session.canvas(args.number(0, "width"), args.number(1, "height"));
      return [`canvas ${args.length ? "resized to " : ""}${size.width}x${size.height}`];
    });
  }

  private registerEditingCommands(): void {
    const session = this.session, presenter = this.presenter;
    this.register("create", "create <type> <id> [params...] [in <containerId>]", (args) => this.create(args));
    this.register("delete", "delete <id>", (args) => {
      args.count(1);
      const document = session.requireDocument();
      const shape = document.requireShape(args.value(0));
      const label = presenter.label(shape);
      return this.edit(new DeleteCommand(document, shape), {
        execute: () => `${label} deleted`, undo: () => `${label} restored into ${presenter.parent(shape)}`,
      });
    });
    this.register("move", "move <id> <dx> <dy>", (args) => {
      args.count(3);
      const document = session.requireDocument();
      const dx = args.number(1, "dx"), dy = args.number(2, "dy");
      const shape = document.requireShape(args.value(0));
      const summary = (undo: boolean): string => {
        const position = presenter.describe(shape).position;
        const action = undo ? "moved back" : "moved";
        return `${presenter.label(shape)} ${action} ` + (position === undefined
          ? `by (${undo ? -dx : dx},${undo ? -dy : dy})` : `to ${position}`);
      };
      return this.edit(new MoveCommand(document, shape, dx, dy), {
        execute: () => summary(false), undo: () => summary(true),
      });
    });
    this.register("scale", "scale <id> <factor>", (args) => {
      args.count(2);
      const document = session.requireDocument();
      const factor = args.number(1, "scale factor");
      const shape = document.requireShape(args.value(0));
      const label = presenter.label(shape);
      return this.edit(new ScaleCommand(document, shape, factor), {
        execute: () => `${label} scaled by ${factor}`, undo: () => `${label} scale restored`,
      });
    });
    this.register("set", "set <id> <attr> <value>", (args) => this.set(args));
    this.register("group", "group <newGid> <id1> <id2>...", (args) => {
      args.count(3, Infinity);
      const document = session.requireDocument();
      const id = args.value(0), targets = args.tokens.slice(1).map((token) => token.value);
      return this.edit(new GroupCommand(document, id, targets), {
        execute: () => `g#${id} created with ${targets.length} children`, undo: () => `g#${id} ungrouped`,
      });
    });
    this.register("ungroup", "ungroup <gid>", (args) => {
      args.count(1);
      const document = session.requireDocument();
      const shape = document.requireShape(args.value(0));
      const count = shape.children.length, label = presenter.label(shape);
      return this.edit(new UngroupCommand(document, shape), {
        execute: () => `${label} ungrouped (${count} children promoted)`,
        undo: () => `${label} restored into ${presenter.parent(shape)}`,
      });
    });
    this.register("addto", "addto <gid> <id>", (args) => {
      args.count(2);
      const document = session.requireDocument();
      const shape = document.requireShape(args.value(1));
      const oldParent = presenter.parent(shape), label = presenter.label(shape), groupId = args.value(0);
      return this.edit(new AddToCommand(document, groupId, shape), {
        execute: () => `${label} moved into g#${groupId}`, undo: () => `${label} restored into ${oldParent}`,
      });
    });
    this.register("front", "front <id>", (args) => this.zOrder(args, FrontCommand, "front"));
    this.register("back", "back <id>", (args) => this.zOrder(args, BackCommand, "back"));
  }

  private registerQueryCommands(): void {
    const session = this.session, presenter = this.presenter;
    this.register("tree", "tree [id]", (args) => {
      args.count(0, 1);
      return session.executor.executeQuery(() => presenter.tree(session.requireDocument(), args.length ? args.value(0) : undefined));
    });
    this.register("show", "show <id>", (args) => {
      args.count(1);
      return session.executor.executeQuery(() => presenter.show(session.requireDocument().requireShape(args.value(0))));
    });
    this.register("help", "help", (args) => {
      args.count(0);
      return session.executor.executeQuery(() => this.help());
    });
  }

  private registerHistoryCommands(): void {
    const session = this.session;
    this.register("undo", "undo", (args) => {
      args.count(0);
      session.requireDocument();
      const command = session.executor.history.peekUndo();
      session.executor.undo();
      return [this.feedback.get(command)?.undo() ?? "undo completed"];
    });
    this.register("redo", "redo", (args) => {
      args.count(0);
      session.requireDocument();
      const command = session.executor.history.peekRedo();
      session.executor.redo();
      return [this.feedback.get(command)?.execute() ?? "redo completed"];
    });
  }

  public get names(): readonly string[] { return [...this.entries.keys()]; }

  public execute(command: ParsedCommand): string[] {
    const entry = this.entries.get(command.name);
    if (entry === undefined) throw new CliError(`unknown command: ${command.name}`);
    return entry.run(new CommandArguments(command.args, entry.syntax));
  }

  private register(name: string, syntax: string, run: CommandEntry["run"]): void {
    this.entries.set(name, { syntax, run });
  }

  private edit(command: Command, feedback: EditFeedback): string[] {
    this.session.executor.execute(command);
    // Ephemeron keys follow the real history; no duplicate stacks or retained old documents.
    this.feedback.set(command, feedback);
    return [feedback.execute()];
  }

  private create(original: CommandArguments): string[] {
    const { args, parent } = original.splitContainer();
    args.count(2, Infinity);
    const document = this.session.requireDocument();
    const type = args.value(0), id = args.value(1);
    const schema = ShapeFactory.parametersFor(type);
    args.count(2 + schema.filter((parameter) => !parameter.optional).length, 2 + schema.length);
    const parameters = schema.map((parameter, index) => {
      const position = index + 2;
      if (position >= args.length) return undefined;
      return parameter.type === "number" ? args.number(position, parameter.name)
        : args.text(position, parameter.name, parameter.name === "text");
    });
    const shape = ShapeFactory.create(type, id, ...parameters);
    return this.edit(new CreateCommand(document, shape, parent), {
      execute: () => `${this.presenter.label(shape)} created${shape.parent ? ` in ${this.presenter.parent(shape)}` : ""}`,
      undo: () => `${this.presenter.label(shape)} removed`,
    });
  }

  private set(args: CommandArguments): string[] {
    args.count(3);
    const document = this.session.requireDocument();
    const shape = document.requireShape(args.value(0)), attribute = args.value(1);
    const parameter = ShapeFactory.parametersFor(shape.kind).find((item) => item.name === attribute);
    if (parameter === undefined && !["fill", "stroke", "stroke-width"].includes(attribute)) throw unknownAttribute(attribute);
    const value = attribute === "stroke-width" || parameter?.type === "number"
      ? args.number(2, attribute) : args.text(2, attribute, attribute === "text");
    const summary = (): string => {
      const current = shape.getAttribute(attribute);
      const formatted = current === undefined ? "<unset>" : attribute === "text" ? JSON.stringify(current) : String(current);
      return `${this.presenter.label(shape)} updated: ${attribute}=${formatted}`;
    };
    return this.edit(new SetCommand(document, shape, attribute, value), { execute: summary, undo: summary });
  }

  private zOrder(
    args: CommandArguments,
    CommandType: new (document: import("../domain/Document.js").Document, target: Shape) => Command,
    direction: string,
  ): string[] {
    args.count(1);
    const document = this.session.requireDocument(), shape = document.requireShape(args.value(0));
    const label = this.presenter.label(shape);
    return this.edit(new CommandType(document, shape), {
      execute: () => `${label} moved to ${direction}`, undo: () => `${label} z-order restored`,
    });
  }

  private help(): string[] {
    const shapeSyntax = ShapeFactory.types.map((type) => {
      const parameters = ShapeFactory.parametersFor(type).map((parameter) => {
        if (parameter.optional) return `[${parameter.name}]`;
        if (parameter.name === "text") return '"content"';
        const name = parameter.name === "width" ? "w" : parameter.name === "height" ? "h" : parameter.name;
        return `<${name}>`;
      });
      return ["  create", type, "<id>", ...parameters, "[in <containerId>]"].join(" ");
    });
    return ["Commands:", ...[...this.entries.values()].map((entry) => `  ${entry.syntax}`),
      "Shape parameters:", ...shapeSyntax,
      "init defaults: 800x600; canvas without arguments is a query.",
      'Use double quotes for text or paths containing spaces. Lines starting with # are comments.',
      'A standalone # outside quotes starts a trailing comment; colors such as #4a90d9 are preserved.',
      "Successful init/read/save/canvas resize starts a new history boundary; queries preserve history.",
      "box is not available in this phase."];
  }
}
