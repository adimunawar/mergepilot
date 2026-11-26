import { loadConfig } from "./core/config.js";

const config = loadConfig();

console.log(`MergePilot foundation loaded (provider: ${config.provider}).`);
console.log("Review execution is not implemented yet.");
