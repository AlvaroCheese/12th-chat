import type { ChatEvent, Side } from "@twitch-graderia/shared";
import { chatEventBus } from "./eventBus.js";

const chantUsers: Array<{ userName: string; side: Side; moderator?: boolean }> = [
  { userName: "CanteraFan", side: "argentina", moderator: true },
  { userName: "Golazo99", side: "argentina" },
  { userName: "LaBanda", side: "argentina" },
  { userName: "VisitanteMX", side: "mexico", moderator: true },
  { userName: "TifoAzul", side: "mexico" },
  { userName: "PorteroFan", side: "mexico" },
];

const chants = ["¡Vamos equipo!", "Dale dale dale", "Olé olé olé"];
let messageIndex = 0;

export function startMockChat(): void {
  console.info("Mock chat generator started (500 simulated joiners)");

  let usersGenerated = 0;
  const joinTimer = setInterval(() => {
    for (let count = 0; count < 10 && usersGenerated < 500; count += 1) {
      const index = usersGenerated;
      const side: Side = index % 2 === 0 ? "argentina" : "mexico";
      const userName = `${side === "argentina" ? "Albi" : "Tri"}Fan${index + 1}`;
      chatEventBus.emit("chat", {
        userId: `mock-fan-${index + 1}`,
        userName,
        text: `!join ${side}`,
        emotes: [],
        badges: {
          broadcaster: false,
          moderator: index % 125 === 0,
          subscriber: index % 3 === 0,
        },
        side,
        timestamp: Date.now(),
      });
      usersGenerated += 1;
    }

    if (usersGenerated >= 500) clearInterval(joinTimer);
  }, 50);

  setInterval(() => {
    const user = chantUsers[messageIndex % chantUsers.length];
    if (!user) return;

    const event: ChatEvent = {
      userId: `mock-${user.userName.toLowerCase()}`,
      userName: user.userName,
      text: chants[Math.floor(messageIndex / chantUsers.length) % chants.length] ?? "¡Vamos equipo!",
      emotes: [],
      badges: {
        broadcaster: false,
        moderator: user.moderator ?? false,
        subscriber: messageIndex % 2 === 0,
      },
      side: user.side,
      timestamp: Date.now(),
    };
    messageIndex += 1;
    chatEventBus.emit("chat", event);
  }, 700);
}
