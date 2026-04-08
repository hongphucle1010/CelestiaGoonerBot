export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  callerName: string;
};

export type InvocationMatch = {
  content: string | null;
  typoedName: string | null;
};

export type BadWordMatch = {
  id: string;
  reactionStyle: string;
};
