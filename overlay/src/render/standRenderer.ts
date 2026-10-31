import { Container, Graphics, Text } from "pixi.js";
import { SIDES, type Fan, type Side, type StandState } from "@twitch-graderia/shared";

interface SideVisuals {
  background: Graphics;
  header: Text;
  joinLabel: Text;
  overflowBackground: Graphics;
  overflowLabel: Text;
}

interface FanSlot {
  container: Container;
  graphic: Graphics;
  key: string;
}

const FAN_CAP = 300;
const JOIN_LABEL_MS = 3_000;
const SKIN_TONES = [0xffd7b5, 0xe9b38f, 0xc7835c, 0x9c6044, 0xf1c7a2, 0xb97754];

export class StandRenderer {
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: "Gradería",
    style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 34, fontWeight: "bold" },
  });
  private readonly visuals = new Map<Side, SideVisuals>();
  private readonly fanSlots: FanSlot[] = [];
  private state: StandState | undefined;
  private width: number;
  private height: number;

  constructor(private readonly stage: Container, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.title.anchor.set(0.5);
    this.stage.addChild(this.panel, this.title);

    for (const side of SIDES) {
      const background = new Graphics();
      const header = new Text({
        text: side.name,
        style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 22, fontWeight: "bold" },
      });
      const joinLabel = new Text({
        text: "",
        style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 14 },
      });
      const overflowBackground = new Graphics();
      const overflowLabel = new Text({
        text: "",
        style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 15, fontWeight: "bold" },
      });
      this.stage.addChild(background, header, joinLabel, overflowBackground, overflowLabel);
      this.visuals.set(side.id, { background, header, joinLabel, overflowBackground, overflowLabel });
    }

    for (let index = 0; index < FAN_CAP; index += 1) {
      const container = new Container();
      const graphic = new Graphics();
      container.addChild(graphic);
      container.visible = false;
      this.stage.addChild(container);
      this.fanSlots.push({ container, graphic, key: "" });
    }

    this.layout();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layout();
  }

  update(state: StandState): void {
    this.state = state;
    this.renderFans();
    this.updateRecentJoinLabels(Date.now());
    this.layout();
  }

  tick(now: number): void {
    this.updateRecentJoinLabels(now);
  }

  private layout(): void {
    const margin = Math.min(40, Math.max(16, this.width * 0.04));
    const panelX = margin;
    const panelY = 68;
    const panelWidth = Math.max(280, this.width - margin * 2);
    const panelHeight = Math.max(220, this.height - panelY - 28);

    this.panel.clear().roundRect(panelX, panelY, panelWidth, panelHeight, 22)
      .fill({ color: 0x081421, alpha: 0.82 })
      .stroke({ color: 0xffffff, alpha: 0.2, width: 2 });
    this.title.position.set(this.width / 2, 34);

    const halfWidth = panelWidth / SIDES.length;
    for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex += 1) {
      const side = SIDES[sideIndex];
      if (!side) continue;
      const sideStart = panelX + sideIndex * halfWidth;
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;

      visuals.background.clear().roundRect(
        sideStart + 8,
        panelY + 8,
        halfWidth - 16,
        panelHeight - 16,
        16,
      ).fill({ color: side.primaryColor, alpha: 0.2 });
      visuals.header.position.set(sideStart + halfWidth / 2, panelY + 28);
      visuals.header.anchor.set(0.5);
      visuals.header.text = `${side.name}  ·  ${this.state?.counts[side.id] ?? 0}`;
      visuals.joinLabel.position.set(sideStart + halfWidth / 2, panelY + 54);
      visuals.joinLabel.anchor.set(0.5);

      const overflow = this.state?.overflowCounts[side.id] ?? 0;
      const bandHeight = 34;
      const bandY = panelY + panelHeight - bandHeight - 12;
      visuals.overflowBackground.visible = overflow > 0;
      visuals.overflowLabel.visible = overflow > 0;
      visuals.overflowBackground.clear();
      if (overflow > 0) {
        visuals.overflowBackground.roundRect(sideStart + 18, bandY, halfWidth - 36, bandHeight, 10)
          .fill({ color: side.primaryColor, alpha: 0.72 });
        for (let dot = 0; dot < 20; dot += 1) {
          const dotX = sideStart + 32 + (dot % 10) * ((halfWidth - 64) / 10);
          const dotY = bandY + 10 + Math.floor(dot / 10) * 10;
          visuals.overflowBackground.circle(dotX, dotY, 2.5)
            .fill({ color: dot % 2 === 0 ? side.secondaryColor : side.primaryColor, alpha: 0.9 });
        }
        visuals.overflowLabel.text = `+${overflow} en la grada`;
        visuals.overflowLabel.anchor.set(0.5);
        visuals.overflowLabel.position.set(sideStart + halfWidth / 2, bandY + bandHeight / 2);
      }
    }

    if (this.state) this.positionFans(this.state, panelX, panelY, panelWidth, panelHeight);
  }

  private renderFans(): void {
    if (!this.state) return;
    const fansBySide = new Map<Side, Fan[]>();
    for (const side of SIDES) fansBySide.set(side.id, []);
    for (const fan of this.state.fans.slice(0, FAN_CAP)) fansBySide.get(fan.side)?.push(fan);

    let slotIndex = 0;
    for (const side of SIDES) {
      for (const fan of fansBySide.get(side.id) ?? []) {
        const slot = this.fanSlots[slotIndex];
        if (!slot) continue;
        const key = `${fan.userId}:${fan.userName}:${fan.side}`;
        if (slot.key !== key) {
          drawFan(slot.graphic, fan, side.primaryColor, side.secondaryColor);
          slot.key = key;
        }
        slot.container.visible = true;
        slotIndex += 1;
      }
    }
    for (let index = slotIndex; index < this.fanSlots.length; index += 1) {
      const slot = this.fanSlots[index];
      if (slot) slot.container.visible = false;
    }
  }

  private positionFans(state: StandState, panelX: number, panelY: number, panelWidth: number, panelHeight: number): void {
    let slotIndex = 0;
    const halfWidth = panelWidth / SIDES.length;
    const bandHeight = 34;

    for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex += 1) {
      const side = SIDES[sideIndex];
      if (!side) continue;
      const sideFans = state.fans.filter((fan) => fan.side === side.id).slice(0, FAN_CAP);
      const sideStart = panelX + sideIndex * halfWidth;
      const columns = Math.max(5, Math.floor((halfWidth - 28) / 27));
      const rows = Math.max(1, Math.ceil(sideFans.length / columns));
      const hasOverflow = state.overflowCounts[side.id] > 0;
      const seatTop = panelY + 76;
      const seatBottom = panelY + panelHeight - (hasOverflow ? bandHeight + 20 : 16);
      const seatHeight = Math.max(24, seatBottom - seatTop);
      const cellWidth = (halfWidth - 24) / columns;
      const rowHeight = seatHeight / rows;

      sideFans.forEach((_fan, index) => {
        const slot = this.fanSlots[slotIndex];
        if (!slot) return;
        const row = Math.floor(index / columns);
        const column = index % columns;
        const depth = rows <= 1 ? 1 : 0.58 + 0.42 * (row / (rows - 1));
        slot.container.scale.set(depth);
        slot.container.position.set(
          sideStart + 12 + cellWidth * (column + 0.5),
          seatTop + rowHeight * (row + 0.52),
        );
        slotIndex += 1;
      });
    }
  }

  private updateRecentJoinLabels(now: number): void {
    const joinsBySide = new Map<Side, string[]>();
    for (const side of SIDES) joinsBySide.set(side.id, []);
    for (const join of this.state?.recentJoins ?? []) {
      if (now - join.timestamp > JOIN_LABEL_MS) continue;
      joinsBySide.get(join.side)?.push(join.userName);
    }

    for (const side of SIDES) {
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      const names = joinsBySide.get(side.id)?.slice(-3) ?? [];
      visuals.joinLabel.text = names.length > 0 ? `Se unieron: ${names.join(" · ")}` : "";
    }
  }
}

function drawFan(graphic: Graphics, fan: Fan, shirtColor: number, accentColor: number): void {
  const hash = hashString(fan.userName);
  const skin = SKIN_TONES[hash % SKIN_TONES.length] ?? SKIN_TONES[0] ?? 0xffd7b5;
  const hasHat = (hash & 1) === 0;
  const hasScarf = (hash & 2) !== 0;

  graphic.clear();
  graphic.roundRect(-7, 9, 14, 14, 4).fill({ color: shirtColor });
  graphic.circle(0, 5, 5.5).fill({ color: skin });
  if (hasScarf) graphic.roundRect(-8, 11, 16, 3, 1).fill({ color: accentColor });
  if (hasHat) {
    graphic.roundRect(-7, -2, 14, 3, 1).fill({ color: accentColor });
    graphic.roundRect(-5, -5, 10, 4, 2).fill({ color: accentColor });
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
