import { createScene } from "./render/scene.js";
import { connectToServer } from "./net/socket.js";
import { startMockMode } from "./mock/index.js";
import { getStandState, setStandState, subscribeToStandState } from "./state/index.js";

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Overlay root element #app was not found");
}

async function startOverlay(host: HTMLElement): Promise<void> {
  const renderer = await createScene(host);
  subscribeToStandState((state) => renderer.update(state));
  renderer.update(getStandState());

  if (new URLSearchParams(window.location.search).get("mock") === "1") {
    startMockMode(setStandState);
  } else {
    connectToServer(setStandState);
  }
}

void startOverlay(appElement);
