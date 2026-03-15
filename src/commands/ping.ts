import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the bot is responding."),

  async execute(interaction) {
    await interaction.reply("Pong!");
  },
};

export default command;
