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
- `GeminiInstruction.txt` is copied into the image and used at runtime
- The image builds TypeScript first, then runs the compiled bot in a smaller production stage

## DeepSeek Chat Flow

1. Say `Celestia chan~`
2. The bot replies `haiii`
3. Your next message within 60 seconds is sent to DeepSeek
4. DeepSeek responds using the persona/context from `GeminiInstruction.txt`

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
  types/
  index.ts
scripts/
  deploy-commands.ts
```
