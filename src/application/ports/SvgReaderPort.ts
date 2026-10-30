import type { Document } from "../../domain/index.js";

export interface SvgReadResult {
  readonly document: Document;
  readonly warnings: readonly string[];
}

export interface SvgReaderPort {
  read(source: string): SvgReadResult;
}
