import { randomUUID } from "node:crypto";
import { closeSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { FileSystem } from "../application/ports/FileSystem.js";

export class NodeFileSystem implements FileSystem {
  public readFile(path: string): string {
    return readFileSync(path, "utf8");
  }

  public writeFile(path: string, content: string): undefined {
    const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    const descriptor = openSync(temporaryPath, "wx");
    let renamed = false;
    try {
      try {
        writeFileSync(descriptor, content, "utf8");
      } finally {
        closeSync(descriptor);
      }
      renameSync(temporaryPath, path);
      renamed = true;
    } finally {
      if (!renamed) {
        // Clean up only the file created by this attempt; keep the original write error.
        try { unlinkSync(temporaryPath); } catch { /* Best-effort cleanup. */ }
      }
    }
  }
}
