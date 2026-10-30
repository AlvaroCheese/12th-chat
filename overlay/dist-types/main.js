import { createScene } from "./render/scene.js";
import { connectToServer } from "./net/socket.js";
import { startMockMode } from "./mock/index.js";
const appElement = document.querySelector("#app");
if (!appElement) {
    throw new Error("Overlay root element #app was not found");
}
async function startOverlay(host) {
    await createScene(host);
    connectToServer();
    if (new URLSearchParams(window.location.search).get("mock") === "1") {
        startMockMode();
    }
}
void startOverlay(appElement);
