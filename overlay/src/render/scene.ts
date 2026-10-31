import { Application } from "pixi.js";
import { StandRenderer } from "./standRenderer.js";

export async function createScene(host: HTMLElement): Promise<StandRenderer> {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    resizeTo: host,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  host.appendChild(app.canvas);
  const renderer = new StandRenderer(app.stage, host.clientWidth, host.clientHeight);
  app.ticker.add(() => renderer.tick(Date.now()));
  window.addEventListener("resize", () => renderer.resize(host.clientWidth, host.clientHeight));
  return renderer;
}
