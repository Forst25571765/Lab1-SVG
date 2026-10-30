import type { FileSystem } from "../../src/application/ports/FileSystem.js";

export class MemoryFileSystem implements FileSystem {
  public readonly files = new Map<string, string>();
  public readonly unwritable = new Set<string>();

  public readFile(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error("file does not exist");
    }
    return content;
  }

  public writeFile(path: string, content: string): undefined {
    if (this.unwritable.has(path)) {
      throw new Error("file is not writable");
    }
    this.files.set(path, content);
  }
}
