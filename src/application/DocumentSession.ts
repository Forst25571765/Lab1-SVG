import { Document } from "../domain/index.js";
import { CommandExecutor } from "./CommandExecutor.js";
import { DocumentOperationError } from "./DocumentOperationError.js";
import type { FileSystem } from "./ports/FileSystem.js";
import type { SvgReadResult, SvgReaderPort } from "./ports/SvgReaderPort.js";
import type { SvgWriterPort } from "./ports/SvgWriterPort.js";

export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

export interface SavedDocument {
  readonly path: string;
  readonly elementCount: number;
}

export interface ReadDocument extends SvgReadResult, SavedDocument {}

export class DocumentSession {
  private document: Document | null = null;
  private readPath: string | null = null;

  public constructor(
    private readonly files: FileSystem,
    private readonly reader: SvgReaderPort,
    private readonly writer: SvgWriterPort,
    public readonly executor = new CommandExecutor(),
  ) {}

  public get currentDocument(): Document | null {
    return this.document;
  }

  public get sourcePath(): string | null {
    return this.readPath;
  }

  public requireDocument(): Document {
    if (this.document === null) {
      throw new DocumentOperationError("no-document", "no document. use 'init' or 'read' first");
    }
    return this.document;
  }

  public init(width = 800, height = 600): Document {
    const replacement = Document.createEmpty(width, height);
    this.executor.executeDocument(() => {
      this.document = replacement;
      this.readPath = null;
    });
    return replacement;
  }

  public read(path: string): ReadDocument {
    let source: string;
    try {
      source = this.files.readFile(path);
    } catch (cause) {
      throw new DocumentOperationError("cannot-read-file", `cannot read file: ${path}`, { cause });
    }
    // Parsing and domain validation must finish before the current session is replaced.
    const result = this.reader.read(source);
    this.executor.executeDocument(() => {
      this.document = result.document;
      this.readPath = path;
    });
    return { ...result, path, elementCount: result.document.size };
  }

  public save(path?: string): SavedDocument {
    const document = this.requireDocument();
    const target = path ?? this.readPath;
    if (target === null || target.trim().length === 0) {
      throw new DocumentOperationError("missing-save-path", "no save path. specify a file path");
    }
    const source = this.writer.write(document);
    this.executor.executeDocument(() => {
      try {
        this.files.writeFile(target, source);
      } catch (cause) {
        throw new DocumentOperationError("cannot-write-file", `cannot write file: ${target}`, { cause });
      }
    });
    // A save-as does not change the path established by read; init clears that path.
    return { path: target, elementCount: document.size };
  }

  public canvas(): CanvasSize;
  public canvas(width: number, height: number): CanvasSize;
  public canvas(width?: number, height?: number): CanvasSize {
    const document = this.requireDocument();
    if (width === undefined && height === undefined) {
      return this.executor.executeQuery(() => ({ width: document.width, height: document.height }));
    }
    if (width === undefined || height === undefined) {
      throw new DocumentOperationError("invalid-canvas-arguments", "canvas requires both width and height");
    }
    this.executor.executeDocument(() => document.setCanvasSize(width, height));
    return { width: document.width, height: document.height };
  }
}
