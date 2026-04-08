import { summonName } from "./config";
import type { InvocationMatch } from "./types/chat";

function getLevenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function isRecognizedSummonName(name: string) {
  return name === summonName || (name.startsWith("cel") && getLevenshteinDistance(name, summonName) <= 2);
}

export function parseSummonInvocation(content: string): InvocationMatch | null {
  const normalizedContent = content.trim().toLowerCase();
  const summonMatch = /^([a-z]+)\s+chan~*(?:\s*,?\s*(.*))?$/i.exec(normalizedContent);

  if (!summonMatch) {
    return null;
  }

  const calledName = summonMatch[1];

  if (!isRecognizedSummonName(calledName)) {
    return null;
  }

  const remainingContent = summonMatch[2]?.trim() ?? "";

  return {
    content: remainingContent.length > 0 ? remainingContent : null,
    typoedName: calledName === summonName ? null : calledName,
  };
}

export function parseMentionInvocation(content: string, botId?: string): InvocationMatch | null {
  if (!botId) {
    return null;
  }

  const mentionMatch = new RegExp(`^<@!?${botId}>\\s*,?\\s*(.+)$`, "i").exec(content.trim());

  if (!mentionMatch?.[1]) {
    return null;
  }

  const remainingContent = mentionMatch[1].trim();
  const summonInvocation = parseSummonInvocation(remainingContent);

  if (summonInvocation) {
    return summonInvocation;
  }

  const optionalNameMatch = /^([a-z]+)\s*,?\s+(.+)$/i.exec(remainingContent);

  if (optionalNameMatch?.[1] && optionalNameMatch[2]) {
    const calledName = optionalNameMatch[1].toLowerCase();

    if (isRecognizedSummonName(calledName)) {
      return {
        content: optionalNameMatch[2].trim(),
        typoedName: calledName === summonName ? null : calledName,
      };
    }
  }

  return {
    content: remainingContent,
    typoedName: null,
  };
}
