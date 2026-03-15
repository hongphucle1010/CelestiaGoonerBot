import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { REST, Routes } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in environment variables.");
}

const botToken = token;
const applicationId = clientId;
const testGuildId = guildId;

type CommandModule = {
  default?: {
    data: {
      toJSON: () => unknown;
    };
  };
};

const commandsPath = path.join(__dirname, "..", "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));
const commands = commandFiles.map((file) => {
  const filePath = path.join(commandsPath, file);
  const commandModule = require(filePath) as CommandModule;

  if (!commandModule.default?.data) {
    throw new Error(`Command file ${file} is missing a default export with data.`);
  }

  return commandModule.default.data.toJSON();
});

const rest = new REST({ version: "10" }).setToken(botToken);

async function deployCommands() {
  console.log(`Refreshing ${commands.length} application command(s) for guild ${testGuildId}...`);

  await rest.put(Routes.applicationGuildCommands(applicationId, testGuildId), {
    body: commands,
  });

  console.log("Slash commands deployed successfully.");
}

void deployCommands().catch((error) => {
  console.error("Failed to deploy slash commands:", error);
  process.exitCode = 1;
});
