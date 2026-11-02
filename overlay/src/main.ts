import { createScene } from "./render/scene.js";
import { connectToServer } from "./net/socket.js";
import { startMockMode } from "./mock/index.js";
import { setStandState, subscribeToStandState } from "./state/index.js";

const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("Overlay root element #app was not found");
}

async function startOverlay(host: HTMLElement): Promise<void> {
  const query = new URLSearchParams(window.location.search);
  const renderer = await createScene(host, query.get("mute") === "1", query.get("debug") === "1");
  subscribeToStandState((state) => renderer.update(state));
  if (query.get("mock") === "1") {
    startMockMode(
      setStandState,
      (chant) => renderer.playChant(chant),
      (goal) => renderer.playGoal(goal),
    );
  } else {
    connectToServer(setStandState, (chant) => renderer.playChant(chant), (goal) => renderer.playGoal(goal));
  }
}

void startOverlay(appElement);
