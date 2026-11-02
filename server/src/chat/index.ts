import type { ChatEvent } from "@twitch-graderia/shared";
import type { EventSubChannelChatMessageEvent } from "@twurple/eventsub-base";

export function normalizeChatMessage(event: EventSubChannelChatMessageEvent): ChatEvent {
  return {
    userId: event.chatterId,
    userName: event.chatterDisplayName || event.chatterName,
    text: event.messageText,
    emotes: event.messageParts
      .filter((part) => part.type === "emote")
      .map((part) => part.type === "emote" ? part.text : ""),
    badges: {
      broadcaster: event.hasBadge("broadcaster"),
      moderator: event.hasBadge("moderator"),
      subscriber: event.hasBadge("subscriber"),
    },
    timestamp: Date.now(),
    source: "twitch",
  };
}
