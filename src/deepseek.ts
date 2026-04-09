import { DEEPSEEK_API_KEY, DEEPSEEK_MODEL, systemInstruction } from "./config";
import type { ConversationMessage } from "./types/chat";

export type ReplyMode = "normal" | "styleRewrite";

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function getStyleRewriteVariationInstructions() {
  const tone = pickRandom([
    "Tone target: smug tease.",
    "Tone target: deadpan meme energy.",
    "Tone target: chaotic gremlin but still elegant.",
    "Tone target: sleepy sarcasm.",
    "Tone target: dramatic anime reaction.",
    "Tone target: playful bully-friend energy.",
  ] as const);

  const structure = pickRandom([
    "Structure: one punchy sentence.",
    "Structure: two short sentences with a strong closer.",
    "Structure: short setup then a meme-ish twist.",
    "Structure: question first, then verdict.",
  ] as const);

  const flavor = pickRandom([
    "Flavor: use no reaction tags.",
    "Flavor: optionally use one square-bracket reaction tag.",
    "Flavor: optionally include one short slang fragment like 'ngl' or 'bro...'.",
    "Flavor: keep it clean and minimal, no filler.",
  ] as const);

  return [tone, structure, flavor];
}

export function formatUserPrompt(messageContent: string, userName: string, guildName: string | undefined, mode: ReplyMode) {
  const base = [
    "Stay fully in character and reply with one short Discord-style message.",
    "Do not explain your reasoning.",
    "Keep the response under 2 sentences.",
  ];

  const modeInstruction =
    mode === "styleRewrite"
      ? [
          "Restate the caller's idea in your own style while preserving the core meaning.",
          "Do not narrate about the caller (no 'you said', no 'spreading rumors', no meta commentary).",
          "Do not quote the input verbatim unless it still sounds natural in-character.",
          "Avoid repeating your common opening patterns; vary cadence and word choice.",
          ...getStyleRewriteVariationInstructions(),
        ]
      : [];

  return [
    ...base,
    ...modeInstruction,
    "",
    "Discord context:",
    `Server: ${guildName ?? "Direct message"}`,
    `User: ${userName}`,
    `Message: ${messageContent}`,
  ].join("\n");
}

export async function generateDeepSeekReply(
  messageContent: string,
  userName: string,
  guildName: string | undefined,
  callerHistory: ConversationMessage[],
  sharedContext: string | null,
  mode: ReplyMode = "normal",
) {
  if (!DEEPSEEK_API_KEY) {
    return "DeepSeek is not configured yet. Add `DEEPSEEK_API_KEY` first, baka.";
  }

  if (!systemInstruction) {
    return "I cannot improvise properly yet. `DeepSeekInstruction.txt` is missing.";
  }

  const prompt = formatUserPrompt(messageContent, userName, guildName, mode);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content: systemInstruction,
        },
        ...(sharedContext
          ? [
              {
                role: "system",
                content: sharedContext,
              },
            ]
          : []),
        ...callerHistory.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: mode === "styleRewrite" ? 1.35 : 1.1,
      max_tokens: 80,
      stream: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const reply = data.choices?.[0]?.message?.content?.trim() ?? "";

  if (!reply) {
    return "ehhh... DeepSeek just stared into the void. Try again.";
  }

  return reply;
}
