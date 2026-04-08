# CelestiaGoonerBot

A starter Discord bot built with TypeScript and `discord.js`.

## Features

- Slash-command based bot setup
- TypeScript project structure
- Example commands: `/ping`, `/help`, `/server`, `/user`
- Guild command deploy script for fast testing
- Message-based summon flow powered by DeepSeek

## Setup

1. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Enable the `MESSAGE CONTENT INTENT` because this bot includes a message-based reply flow.
3. Copy `.env.example` to `.env`.
4. Fill in:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_MODEL` (optional, default is `deepseek-chat`)
5. Install dependencies:

```bash
npm install
```

6. Deploy slash commands to your test server:

```bash
npm run deploy:commands
```

7. Start the bot in development mode:

```bash
npm run dev
```

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build -d
```

Stop the container:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f bot
```

Deploy slash commands from the container:

```bash
docker compose run --rm bot npm run deploy:commands
```

Notes:
- `docker-compose.yml` reads environment variables from your local `.env`
- `DeepSeekInstruction.txt` is copied into the image and used at runtime
- The image builds TypeScript first, then runs the compiled bot in a smaller production stage

## DeepSeek Chat Flow

The bot keeps up to 30 recent messages per caller, plus up to 10 recent messages from each other caller as shared background context for future DeepSeek replies.

You can talk to the bot in any of these ways:

1. Two-step flow:
   - Say `Celestia chan~`
   - The bot replies `haiii`
   - Your next message within 60 seconds is sent to DeepSeek
2. One-message summon:
   - `Celestia chan~, tell me something funny`
   - `Celestia chan~ tell me something funny`
   - simple typos like `Celesia chan~` or `Celetia chan~` still work, but the bot will call out the wrong name
3. Mention the bot directly:
   - `@CelestiaGooner tell me something funny`
   - `@CelestiaGooner, tell me something funny`
   - `@CelestiaGooner, Celestia tell me something funny`

DeepSeek responds using the persona/context from `DeepSeekInstruction.txt`.

The bot can also jump in automatically when a message contains certain trigger words such as `pregnent`, `pregnant`, `pregnat`, `monkey`, `monke`, `onink`, `oink`, `horny`, `seggs`, `hentai`, `boobs`, `dick`, or `cum`.

Those trigger reactions have:
- a 10-minute cooldown so the bot does not reply too often in the same channel
- different reaction styles per trigger family
- simple typo support for trigger words

## Build

```bash
npm run build
npm start
```

## Invite URL

Use this template, replacing `CLIENT_ID` with your application ID:

```text
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=274877910016
```

## Project Structure

```text
src/
  commands/
  handlers/
  types/
  config.ts
  deepseek.ts
  history.ts
  badWords.ts
  summon.ts
  loadCommands.ts
  index.ts
scripts/
  deploy-commands.ts
```
