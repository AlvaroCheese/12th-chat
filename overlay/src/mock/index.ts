import type { ChatEvent } from "@twitch-graderia/shared";

const mockMessages = ["¡Vamos!", "Dale equipo", "Olé olé"];

export function startMockMode(): void {
  console.info("Mock mode enabled");
  window.setInterval(() => {
    const event: ChatEvent = {
      userId: `mock-${Math.floor(Math.random() * 500)}`,
      username: `Fan${Math.floor(Math.random() * 500)}`,
      message: mockMessages[Math.floor(Math.random() * mockMessages.length)] ?? "¡Vamos!",
      side: Math.random() > 0.5 ? "home" : "away",
      timestamp: Date.now(),
    };
    console.info("Mock chat event", event);
  }, 1500);
}
