import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ArchitectureCheck } from "./ArchitectureCheck.js";

const root = new URL("../", import.meta.url);
const checker = new ArchitectureCheck();
let count = 0;
let failures = 0;

function inspect(directory: string): void {
  for (const entry of readdirSync(new URL(`${directory}/`, root), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) inspect(path);
    else if (entry.isFile() && path.endsWith(".ts")) {
      count++;
      for (const issue of checker.inspect(path, readFileSync(fileURLToPath(new URL(path, root)), "utf8"))) {
        failures++;
        console.error(`${issue.file}:${issue.line}: ${issue.message}`);
      }
    }
  }
}

try {
  inspect("src");
} finally {
  checker.close();
}
console.log(`Architecture check: ${count} source files, ${failures} violations.`);
if (failures > 0) process.exitCode = 1;
