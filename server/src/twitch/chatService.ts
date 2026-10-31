import { ApiClient } from "@twurple/api";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { RefreshingAuthProvider } from "@twurple/auth";
import { chatEventBus } from "../chat/eventBus.js";
import { normalizeChatMessage } from "../chat/index.js";
import type { TokenStore } from "./tokenStore.js";

const CHAT_INTENT = "graderia-chat";
const CHAT_SCOPE = "user:read:chat";

export interface ChatConnectionStatus {
  connected: boolean;
  channel?: string;
}

export class TwitchChatService {
  private listener: EventSubWsListener | undefined;
  private status: ChatConnectionStatus = { connected: false };

  constructor(
    private readonly authProvider: RefreshingAuthProvider,
    private readonly tokenStore: TokenStore,
  ) {}

  getStatus(): ChatConnectionStatus {
    return { ...this.status };
  }

  async connect(userId: string): Promise<string> {
    const apiClient = new ApiClient({ authProvider: this.authProvider });
    const broadcaster = await apiClient.users.getUserById(userId);

    if (!broadcaster) {
      throw new Error("The Twitch account could not be found");
    }

    this.listener?.stop();
    this.status = { connected: false, channel: broadcaster.name };
    const listener = new EventSubWsListener({ apiClient });
    this.listener = listener;

    listener.onUserSocketConnect((connectedUserId) => {
      if (connectedUserId === userId) {
        this.status = { connected: true, channel: broadcaster.name };
        console.info(`Twitch EventSub connected for ${broadcaster.name}`);
      }
    });
    listener.onUserSocketDisconnect((disconnectedUserId) => {
      if (disconnectedUserId === userId) {
        this.status = { connected: false, channel: broadcaster.name };
        console.info(`Twitch EventSub disconnected for ${broadcaster.name}; reconnecting`);
      }
    });

    listener.start();
    listener.onChannelChatMessage(userId, userId, (message) => {
      chatEventBus.emit("chat", normalizeChatMessage(message));
    });

    const token = await this.authProvider.getAccessTokenForUser(userId);
    if (token) await this.tokenStore.save({ userId, token });
    return broadcaster.name;
  }

  async restore(): Promise<string | undefined> {
    const saved = await this.tokenStore.load();
    if (!saved) return undefined;

    this.authProvider.addUser(saved.userId, saved.token, [CHAT_INTENT]);
    return this.connect(saved.userId);
  }

  async saveRefreshedToken(userId: string, accessToken: Parameters<TokenStore["save"]>[0]["token"]): Promise<void> {
    await this.tokenStore.save({ userId, token: accessToken });
  }
}

export { CHAT_INTENT, CHAT_SCOPE };
