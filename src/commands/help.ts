import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List the available bot commands."),

  async execute(interaction) {
    const commandList = Array.from(interaction.client.application.commands.cache.values())
      .map((registeredCommand) => `/${registeredCommand.name}`)
      .sort()
      .join("\n");

    await interaction.reply({
      content: commandList
        ? `Available commands:\n${commandList}`
        : "Commands are still syncing. Try again in a moment.",
      flags: ["Ephemeral"],
    });
  },
};

export default command;
