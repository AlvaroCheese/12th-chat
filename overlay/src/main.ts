import { createScene } from "./render/scene.js";
import { connectToServer } from "./net/socket.js";
import { startMockMode } from "./mock/index.js";

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Overlay root element #app was not found");
}

async function startOverlay(host: HTMLElement): Promise<void> {
  await createScene(host);
  connectToServer();

  if (new URLSearchParams(window.location.search).get("mock") === "1") {
    startMockMode();
  }
}

void startOverlay(appElement);
