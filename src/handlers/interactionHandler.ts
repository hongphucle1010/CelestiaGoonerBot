import {
  type Client,
  Collection,
  Events,
  type InteractionReplyOptions,
} from "discord.js";

import type { Command } from "../types/Command";

export function registerInteractionHandler(client: Client, commands: Collection<string, Command>) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commands.get(interaction.commandName);

    if (!command) {
      const reply: InteractionReplyOptions = {
        content: "That command is not available right now.",
        flags: ["Ephemeral"],
      };

      await interaction.reply(reply);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error while running /${interaction.commandName}:`, error);

      const reply: InteractionReplyOptions = {
        content: "Something went wrong while running that command.",
        flags: ["Ephemeral"],
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
        return;
      }

      await interaction.reply(reply);
    }
  });
}
