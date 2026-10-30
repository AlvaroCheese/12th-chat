import { Application, Container, Graphics, Text } from "pixi.js";

export async function createScene(host: HTMLElement): Promise<void> {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    resizeTo: host,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const scene = new Container();
  const stand = new Graphics()
    .roundRect(0, 0, Math.min(host.clientWidth - 48, 680), 180, 24)
    .fill({ color: 0x14213d, alpha: 0.78 })
    .stroke({ color: 0xfca311, width: 4 });
  stand.position.set(24, 24);

  const title = new Text({
    text: "Gradería",
    style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 36, fontWeight: "bold" },
  });
  title.anchor.set(0.5);
  title.position.set(24 + Math.min(host.clientWidth - 48, 680) / 2, 114);

  scene.addChild(stand, title);
  app.stage.addChild(scene);
  host.appendChild(app.canvas);
}
