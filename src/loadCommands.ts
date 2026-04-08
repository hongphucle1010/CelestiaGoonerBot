import fs from "node:fs";
import path from "node:path";
import { Collection } from "discord.js";

import type { Command } from "./types/Command";

export function loadCommands(commandsDir: string) {
  const commands = new Collection<string, Command>();
  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter((file) => [".js", ".ts"].includes(path.extname(file)) && !file.endsWith(".d.ts"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsDir, file);
    const commandModule = require(filePath) as { default?: Command };
    const command = commandModule.default;

    if (!command?.data || !command.execute) {
      console.warn(`Skipping ${file}: missing command data or execute handler.`);
      continue;
    }

    commands.set(command.data.name, command);
  }

  return commands;
}
