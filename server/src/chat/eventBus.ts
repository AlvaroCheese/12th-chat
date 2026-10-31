import { EventEmitter } from "node:events";
import type { ChatEvent } from "@twitch-graderia/shared";

type ChatEventMap = { chat: [event: ChatEvent] };

export class ChatEventBus extends EventEmitter {
  on<K extends keyof ChatEventMap>(event: K, listener: (...args: ChatEventMap[K]) => void): this {
    return super.on(event, listener);
  }

  emit<K extends keyof ChatEventMap>(event: K, ...args: ChatEventMap[K]): boolean {
    return super.emit(event, ...args);
  }
}

export const chatEventBus = new ChatEventBus();
