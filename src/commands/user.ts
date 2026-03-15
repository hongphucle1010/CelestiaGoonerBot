import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Show information about the user who ran the command."),

  async execute(interaction) {
    await interaction.reply(
      `You are **${interaction.user.username}** and joined Discord on **${interaction.user.createdAt.toDateString()}**.`,
    );
  },
};

export default command;
