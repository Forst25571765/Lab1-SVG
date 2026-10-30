/** Synchronous text IO; a successful return means the operation has completed. */
export interface FileSystem {
  readFile(path: string): string;
  // undefined (rather than void) also rejects accidentally injected async implementations.
  writeFile(path: string, content: string): undefined;
}
