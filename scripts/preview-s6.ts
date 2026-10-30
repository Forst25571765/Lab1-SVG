import { fileURLToPath } from "node:url";
import { S6CliPreviewServer } from "./S6CliPreviewServer.js";

const port = Number(process.env.S6_PREVIEW_PORT ?? 8766);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid S6_PREVIEW_PORT");
const output = fileURLToPath(new URL("../tmp/s6-cli-preview/", import.meta.url));
const server = new S6CliPreviewServer(output).start(port);
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
