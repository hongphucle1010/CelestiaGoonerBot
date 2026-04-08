import fs from "node:fs";
import path from "node:path";

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? "";
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

const instructionPath = path.join(process.cwd(), "DeepSeekInstruction.txt");
export const systemInstruction = fs.existsSync(instructionPath)
  ? fs.readFileSync(instructionPath, "utf8").trim()
  : "";

export const summonPrefix = "celestia chan~";
export const summonName = "celestia";
export const maxCallerHistoryMessages = 30;
export const maxSharedHistoryMessages = 10;
export const badWordReplyCooldownMs = 600_000;
export const summonPendingTimeoutMs = 60_000;
