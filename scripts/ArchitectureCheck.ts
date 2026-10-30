import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript/unstable/ast";
import { API } from "typescript/unstable/sync";

export interface ArchitectureIssue {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/** Static guard for the project's module boundaries; complements behavioral tests and review. */
export class ArchitectureCheck {
  private source = "";
  private initialized = false;
  private readonly input = fileURLToPath(new URL("../tmp/s7-architecture-virtual/check.ts", import.meta.url)).replace(/\\/g, "/");
  private readonly config = posix.join(posix.dirname(this.input), "tsconfig.json");
  // TypeScript 7 exposes parsing through project snapshots. This project exists
  // only in memory; it never overwrites the source files being inspected.
  private readonly api = new API({ fs: {
    readFile: (path) => path.replace(/\\/g, "/") === this.input ? this.source
      : path.replace(/\\/g, "/") === this.config
        ? '{"compilerOptions":{"noLib":true,"noResolve":true},"files":["check.ts"]}' : null,
    fileExists: (path) => [this.input, this.config].includes(path.replace(/\\/g, "/")),
    directoryExists: (path) => posix.dirname(this.input) === path.replace(/\\/g, "/"),
  } });
  private readonly allowed: Readonly<Record<string, readonly string[]>> = {
    domain: ["domain"], commands: ["commands", "domain"],
    application: ["application", "commands", "domain"],
    cli: ["cli", "application", "commands", "domain"],
    infrastructure: ["infrastructure", "domain"],
  };
  private readonly shapeNames = new Set(["rect", "circle", "ellipse", "line", "text", "g"]);
  private readonly leafClasses = new Set(["Rect", "Circle", "Ellipse", "Line", "Text"]);
  private readonly discriminators = new Set(["kind", "type", "tag", "tagName", "localName"]);
  private readonly commandNames = new Set([
    "init", "read", "save", "canvas", "create", "delete", "move", "scale", "set", "group",
    "ungroup", "addto", "front", "back", "tree", "show", "help", "undo", "redo",
  ]);

  public inspect(path: string, source: string): ArchitectureIssue[] {
    this.source = source;
    this.api.clearSourceFileCache();
    const snapshot = this.api.updateSnapshot(this.initialized
      ? { fileChanges: { invalidateAll: true } } : { openProjects: [this.config] });
    this.initialized = true;
    try {
      const parsed = snapshot.getProject(this.config)?.program.getSourceFile(this.input);
      if (parsed === undefined) throw new Error("could not parse architecture input");
      return this.inspectSource(path, parsed);
    } finally {
      snapshot.dispose();
    }
  }

  public close(): void { this.api.close(); }

  private inspectSource(path: string, parsed: ts.SourceFile): ArchitectureIssue[] {
    const file = path.replace(/\\/g, "/");
    const issues: ArchitectureIssue[] = [];
    const report = (node: ts.Node, message: string): void => {
      issues.push({ file, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1, message });
    };
    const classes: ts.ClassDeclaration[] = [];
    const leafAliases = new Set(this.leafClasses);
    for (const statement of parsed.statements) {
      if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings
        && ts.isNamedImports(statement.importClause.namedBindings)) {
        for (const name of statement.importClause.namedBindings.elements) {
          if (this.leafClasses.has((name.propertyName ?? name.name).text)) leafAliases.add(name.name.text);
        }
      }
    }
    const visit = (node: ts.Node): void => {
      const specifier = this.moduleSpecifier(node);
      if (specifier !== undefined) {
        const violation = this.dependencyViolation(file, specifier);
        if (violation) report(node, violation);
      }
      if (ts.isCallExpression(node) && this.isModuleCall(node) && specifier === undefined) {
        report(node, "dynamic module paths cannot be checked");
      }
      if (ts.isClassDeclaration(node)) {
        classes.push(node);
        if (node.name?.text !== posix.basename(file, ".ts")) report(node, "class name must match its filename");
      }
      if (file !== "src/cli/CommandRegistry.ts") {
        if (ts.isSwitchStatement(node) && this.isCommandDiscriminator(node.expression)
          && node.caseBlock.clauses.some((clause) => ts.isCaseClause(clause) && this.isCommandName(clause.expression))) {
          report(node, "command-name dispatch belongs in CommandRegistry");
        }
        if (ts.isBinaryExpression(node) && this.isComparison(node)
          && ((this.isCommandDiscriminator(node.left) && this.isCommandName(node.right))
            || (this.isCommandDiscriminator(node.right) && this.isCommandName(node.left)))) {
          report(node, "command-name dispatch belongs in CommandRegistry");
        }
      }
      if (file !== "src/domain/ShapeFactory.ts") {
        if (ts.isSwitchStatement(node) && this.isDiscriminator(node.expression)
          && node.caseBlock.clauses.some((clause) => ts.isCaseClause(clause) && this.isShapeName(clause.expression))) {
          report(node, "shape-name dispatch belongs in ShapeFactory");
        }
        if (ts.isBinaryExpression(node)) {
          if (this.isComparison(node)
            && ((this.isDiscriminator(node.left) && this.isShapeName(node.right))
              || (this.isDiscriminator(node.right) && this.isShapeName(node.left)))) {
            report(node, "shape-name dispatch belongs in ShapeFactory");
          }
          const className = ts.isIdentifier(node.right) ? node.right.text
            : ts.isPropertyAccessExpression(node.right) ? node.right.name.text : undefined;
          if (node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && className && leafAliases.has(className)) {
            report(node, "use Shape polymorphism instead of concrete leaf-type branches");
          }
        }
      }
      node.forEachChild(visit);
    };
    visit(parsed);
    if (classes.length > 1) report(classes[1], "only one class is allowed per file");
    return issues;
  }

  private dependencyViolation(file: string, specifier: string): string | undefined {
    const layer = file.split("/")[1];
    if (!specifier.startsWith(".")) {
      if (file === "src/main.ts" && specifier.startsWith("node:")) return;
      if (layer === "infrastructure" && (specifier.startsWith("node:") || specifier === "@xmldom/xmldom")) return;
      return `external dependency is not allowed here: ${specifier}`;
    }
    const target = posix.normalize(posix.join(posix.dirname(file), specifier)).replace(/\.js$/, ".ts");
    if (!target.startsWith("src/")) return `dependency escapes src: ${specifier}`;
    if (target.startsWith("src/domain/internal/")
      && !["src/domain/Document.ts", "src/domain/Group.ts", "src/domain/Shape.ts"].includes(file)) {
      return "domain tree mutation internals are private to Document, Group and Shape";
    }
    if (file === "src/main.ts") return;
    const targetLayer = target.split("/")[1];
    const port = target.startsWith("src/application/ports/");
    if (file.startsWith("src/application/ports/") && targetLayer !== "domain" && !port) {
      return `ports may only depend on domain or other ports: ${specifier}`;
    }
    if (layer === "infrastructure" && port) return;
    if (!this.allowed[layer]?.includes(targetLayer)) return `forbidden layer dependency: ${layer} -> ${specifier}`;
    return;
  }

  private moduleSpecifier(node: ts.Node): string | undefined {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier.text;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteral(node.argument.literal)) return node.argument.literal.text;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      return node.moduleReference.expression.text;
    }
    if (ts.isCallExpression(node) && this.isModuleCall(node)
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) return node.arguments[0].text;
    return;
  }

  private isModuleCall(node: ts.CallExpression): boolean {
    return node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require");
  }

  private isDiscriminator(expression: ts.Expression): boolean {
    if (ts.isParenthesizedExpression(expression)) return this.isDiscriminator(expression.expression);
    const name = ts.isIdentifier(expression) ? expression.text
      : ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
    return name !== undefined && this.discriminators.has(name);
  }

  private isShapeName(expression: ts.Expression): boolean {
    return ts.isStringLiteral(expression) && this.shapeNames.has(expression.text);
  }

  private isCommandDiscriminator(expression: ts.Expression): boolean {
    if (ts.isParenthesizedExpression(expression)) return this.isCommandDiscriminator(expression.expression);
    return (ts.isIdentifier(expression) && ["command", "commandName"].includes(expression.text))
      || (ts.isPropertyAccessExpression(expression) && expression.name.text === "name");
  }

  private isCommandName(expression: ts.Expression): boolean {
    return ts.isStringLiteral(expression) && this.commandNames.has(expression.text);
  }

  private isComparison(expression: ts.BinaryExpression): boolean {
    return [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(expression.operatorToken.kind);
  }
}
