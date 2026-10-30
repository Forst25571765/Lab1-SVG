import { fileURLToPath } from "node:url";
import { S5PreviewServer } from "./S5PreviewServer.js";

const port = Number(process.env.S5_PREVIEW_PORT ?? 8765);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid S5_PREVIEW_PORT");
const outputDirectory = fileURLToPath(new URL("../tmp/s5-http-preview/", import.meta.url));
const server = new S5PreviewServer(outputDirectory).start(port);
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
const stop = () => server.close();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
