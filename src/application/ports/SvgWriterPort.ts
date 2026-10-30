import type { Document } from "../../domain/index.js";

export interface SvgWriterPort {
  write(document: Document): string;
}
