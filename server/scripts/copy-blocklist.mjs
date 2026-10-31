import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(serverRoot, "src/chat/blocklist.json");
const destination = resolve(serverRoot, "dist/chat/blocklist.json");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
