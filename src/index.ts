import "dotenv/config";

import path from "node:path";
import { Client, Events, GatewayIntentBits } from "discord.js";

import { DISCORD_TOKEN } from "./config";
import { loadCommands } from "./loadCommands";
import { registerInteractionHandler } from "./handlers/interactionHandler";
import { registerMessageHandler } from "./handlers/messageHandler";

if (!DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in environment variables.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commandsPath = path.join(__dirname, "commands");
const commands = loadCommands(commandsPath);

registerMessageHandler(client);
registerInteractionHandler(client, commands);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

void client.login(DISCORD_TOKEN);
