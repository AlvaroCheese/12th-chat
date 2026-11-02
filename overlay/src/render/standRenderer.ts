import { Container, Graphics, Text } from "pixi.js";
import { SIDES, type ChantEvent, type Fan, type GoalEvent, type MatchEndedEvent, type MatchStartedEvent, type PressureMood, type PressureState, type Side, type StandState } from "@twitch-graderia/shared";

interface SideVisuals {
  background: Graphics;
  seatMarkers: Graphics;
  header: Text;
  joinLabel: Text;
  overflowBackground: Graphics;
  overflowLabel: Text;
  pressureTrack: Graphics;
  pressureFill: Graphics;
  targetPressure: number;
  visiblePressure: number;
  targetMood: PressureMood;
  targetEnergy: number;
  moodEnergy: number;
  moodDim: number;
  targetDim: number;
  seatVisibility: number;
  targetSeatVisibility: number;
  meterColor: number;
  targetMeterColor: number;
  bannerBackground: Graphics;
  bannerText: Text;
  bannerEndsAt: number;
  bannerDurationMs: number;
  bannerIntensity: number;
  displayedCount: number;
  targetCount: number;
}

interface FanSprite {
  container: Container;
  graphic: Graphics;
  lifecycle: "free" | "active" | "leaving";
  userId?: string;
  userName?: string;
  side?: Side;
  seat?: number;
  baseX: number;
  baseY: number;
  depth: number;
  animationStartedAt: number;
  animationDurationMs: number;
  animationKind?: "enter" | "leave";
  bouncePhase: number;
}

interface LayoutGeometry {
  panelX: number;
  panelY: number;
  panelWidth: number;
  panelHeight: number;
  halfWidth: number;
  seatTop: number;
  seatBottom: number;
  seatColumns: number;
  seatRows: number;
}

interface ConfettiParticle {
  graphic: Graphics;
  startedAt: number;
  durationMs: number;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
  active: boolean;
}

interface GoalAnimation {
  side: Side;
  startedAt: number;
  endsAt: number;
}

const FAN_CAP = 300;
const FAN_POOL_CAP = 600;
const SEAT_COLUMNS = 15;
const SEAT_ROWS = 20;
const JOIN_LABEL_MS = 3_000;
const ENTER_ANIMATION_MS = 360;
const LEAVE_ANIMATION_MS = 440;
const SKIN_TONES = [0xffd7b5, 0xe9b38f, 0xc7835c, 0x9c6044, 0xf1c7a2, 0xb97754];
const CONFETTI_POOL_SIZE = 160;
const GOAL_ANIMATION_MS = 4_500;

export class StandRenderer {
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: "Gradería",
    style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 34, fontWeight: "bold" },
  });
  private readonly debugText: Text;
  private readonly fanLayer = new Container();
  private readonly effectsLayer = new Container();
  private readonly scoreboardBackground = new Graphics();
  private readonly scoreboard = new Text({
    text: "Argentina 0  -  0 Mexico",
    style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: "bold" },
  });
  private readonly goalBannerBackground = new Graphics();
  private readonly fullTimeBackground = new Graphics();
  private readonly fullTimeText = new Text({ text: "", style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 27, fontWeight: "bold", align: "center" } });
  private readonly goalBanner = new Text({
    text: "",
    style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 58, fontWeight: "bold", align: "center" },
  });
  private readonly confetti: ConfettiParticle[] = [];
  private readonly visuals = new Map<Side, SideVisuals>();
  private readonly fanPool: FanSprite[] = [];
  private readonly freeSprites: FanSprite[] = [];
  private readonly activeByUser = new Map<string, FanSprite>();
  private readonly seatOccupants = new Map<string, FanSprite>();
  private readonly leavingSprites = new Set<FanSprite>();
  private readonly pendingBySeat = new Map<string, Fan>();
  private state: StandState | undefined;
  private geometry: LayoutGeometry;
  private lastTickAt = 0;
  private readonly muted: boolean;
  private audioContext: AudioContext | undefined;
  private noiseGain: GainNode | undefined;
  private lastAudioTarget = 0;
  private goalAnimation: GoalAnimation | undefined;
  private scoreboardScaleStartedAt = 0;
  private fullTime = false;

  constructor(private readonly stage: Container, width: number, height: number, muted = false, debug = false) {
    this.muted = muted;
    this.debugText = new Text({
      text: "",
      style: { fill: "#ffffff", fontFamily: "monospace", fontSize: 12, fontWeight: "bold" },
    });
    this.debugText.visible = debug;
    this.geometry = this.makeGeometry(width, height);
    this.fanLayer.sortableChildren = true;
    this.title.anchor.set(0.5);
    this.scoreboard.anchor.set(0.5);
    this.goalBanner.anchor.set(0.5);
    this.goalBanner.visible = false;
    this.goalBannerBackground.visible = false;
    this.fullTimeBackground.visible = false;
    this.fullTimeText.visible = false;
    this.stage.addChild(this.panel);

    for (const side of SIDES) {
      const background = new Graphics();
      const seatMarkers = new Graphics();
      const header = new Text({
        text: side.name,
        style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 22, fontWeight: "bold" },
      });
      const joinLabel = new Text({
        text: "",
        style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 13 },
      });
      const overflowBackground = new Graphics();
      const pressureTrack = new Graphics();
      const pressureFill = new Graphics();
      const overflowLabel = new Text({
        text: "",
        style: { fill: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: 15, fontWeight: "bold" },
      });
      const bannerBackground = new Graphics();
      const bannerText = new Text({
        text: "",
        style: {
          fill: "#ffffff",
          fontFamily: "Arial, sans-serif",
          fontSize: 18,
          fontWeight: "bold",
          align: "center",
          wordWrap: true,
          wordWrapWidth: Math.max(160, this.geometry.halfWidth - 44),
        },
      });
      bannerText.visible = false;
      bannerBackground.visible = false;
      this.stage.addChild(
        background,
        seatMarkers,
        header,
        joinLabel,
        overflowBackground,
        overflowLabel,
        pressureTrack,
        pressureFill,
        bannerBackground,
        bannerText,
      );
      this.visuals.set(side.id, {
        background,
        seatMarkers,
        header,
        joinLabel,
        overflowBackground,
        overflowLabel,
        bannerBackground,
        bannerText,
        bannerEndsAt: 0,
        bannerDurationMs: 6_000,
        bannerIntensity: 0,
        displayedCount: 0,
        targetCount: 0,
        pressureTrack,
        pressureFill,
        targetPressure: 0,
        visiblePressure: 0,
        targetMood: "cold",
        targetEnergy: 0.12,
        moodEnergy: 0.12,
        moodDim: 0.3,
        targetDim: 0.3,
        seatVisibility: 0.85,
        targetSeatVisibility: 0.85,
        meterColor: 0x5ba6c2,
        targetMeterColor: 0x5ba6c2,
      });
    }

    this.stage.addChild(this.fanLayer);
    this.effectsLayer.addChild(this.scoreboardBackground, this.scoreboard, this.goalBannerBackground, this.goalBanner, this.fullTimeBackground, this.fullTimeText);
    for (let index = 0; index < CONFETTI_POOL_SIZE; index += 1) {
      const graphic = new Graphics();
      graphic.visible = false;
      this.confetti.push({
        graphic,
        startedAt: 0,
        durationMs: 0,
        velocityX: 0,
        velocityY: 0,
        rotationSpeed: 0,
        active: false,
      });
      this.effectsLayer.addChild(graphic);
    }
    this.effectsLayer.addChild(this.title, this.debugText);
    this.stage.addChild(this.effectsLayer);
    this.layout();
    if (!muted) this.startProceduralCrowdSound();
  }

  resize(width: number, height: number): void {
    this.geometry = this.makeGeometry(width, height);
    this.layout();
    for (const sprite of this.activeByUser.values()) {
      if (sprite.side !== undefined && sprite.seat !== undefined) this.positionSprite(sprite, sprite.side, sprite.seat);
    }
  }

  update(state: StandState): void {
    const isFirstState = this.state === undefined;
    this.state = state;
    this.setScoreboard(state.scoreBySide, true);
    const now = Date.now();
    for (const side of SIDES) {
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      visuals.targetCount = state.counts[side.id];
      this.setMoodTarget(visuals, state.pressure[side.id]);
      const singing = state.singing[side.id];
      if (singing && singing.endsAt > now) {
        if (visuals.bannerText.text !== singing.text) this.setBanner(side.id, singing, now);
        visuals.bannerEndsAt = Math.max(visuals.bannerEndsAt, singing.endsAt);
        visuals.bannerIntensity = singing.intensity;
      }
    }

    const targetFans = new Map(state.fans.slice(0, FAN_CAP).map((fan) => [seatKey(fan.side, fan.seat), fan]));
    for (const userId of state.leftIds) {
      const sprite = this.activeByUser.get(userId);
      if (sprite) this.beginDeparture(sprite, now);
    }

    const animateArrivals = !isFirstState || state.joinedIds.length > 0;
    for (const fan of targetFans.values()) {
      this.reconcileFan(fan, now, animateArrivals);
    }

    for (const [userId, sprite] of this.activeByUser) {
      const key = seatKey(sprite.side!, sprite.seat!);
      if (targetFans.get(key)?.userId !== userId) this.beginDeparture(sprite, now);
    }

    for (const [key, pendingFan] of this.pendingBySeat) {
      if (targetFans.get(key)?.userId !== pendingFan.userId) this.pendingBySeat.delete(key);
    }

    this.updateJoinLabelText(now);
    if (this.debugText.visible) {
      const rowsBySide: Record<Side, number[]> = { argentina: new Array(SEAT_ROWS).fill(0), mexico: new Array(SEAT_ROWS).fill(0) };
      for (const fan of state.fans) {
        const row = Math.floor(fan.seat / SEAT_COLUMNS);
        const rowCounts = rowsBySide[fan.side];
        if (rowCounts[row] !== undefined) rowCounts[row] += 1;
      }
      this.debugText.text = SIDES.map((side) => {
        const pressure = state.pressure[side.id];
        const occupancy = rowsBySide[side.id].map((count) => `${Math.round((count / SEAT_COLUMNS) * 100)}%`).join(" ");
        return `${side.name}: ${pressure.value.toFixed(2)} · ${pressure.mood}\nrows: ${occupancy}`;
      }).join("\n");
    }
    this.layout();
  }

  playChant(chant: ChantEvent): void {
    const now = Date.now();
    const visuals = this.visuals.get(chant.side);
    if (!visuals) return;
    this.setBanner(chant.side, {
      text: chant.text,
      intensity: chant.intensity,
      endsAt: now + chant.durationMs,
    }, now, chant.durationMs);
    if (this.audioContext?.state === "suspended") void this.audioContext.resume().catch(() => undefined);
  }

  playGoal(goal: GoalEvent): void {
    const now = Date.now();
    const side = SIDES.find((candidate) => candidate.id === goal.side);
    if (!side) return;
    this.goalAnimation = { side: goal.side, startedAt: now, endsAt: now + GOAL_ANIMATION_MS };
    this.setScoreboard(goal.scoreBySide, true);
    this.goalBanner.text = `GOOOL · ${side.name}`;
    this.goalBanner.visible = true;
    this.goalBannerBackground.visible = true;
    this.goalBanner.alpha = 1;
    this.goalBanner.scale.set(0.65);
    this.spawnConfetti(goal.side, now);
    this.playGoalSound();
    this.layout();
  }

  playMatchEnded(event: MatchEndedEvent): void {
    this.fullTime = true;
    this.goalAnimation = undefined;
    this.goalBanner.visible = false;
    this.goalBannerBackground.visible = false;
    for (const visuals of this.visuals.values()) {
      visuals.bannerText.visible = false;
      visuals.bannerBackground.visible = false;
    }
    for (const particle of this.confetti) {
      particle.active = false;
      particle.graphic.visible = false;
    }
    const argentina = SIDES.find((side) => side.id === "argentina")?.name ?? "Argentina";
    const mexico = SIDES.find((side) => side.id === "mexico")?.name ?? "Mexico";
    const score = `${argentina} ${event.finalScoreBySide.argentina} - ${event.finalScoreBySide.mexico} ${mexico}`;
    this.fullTimeText.text = event.status === "generating"
      ? `FULL TIME · ${score}\nGenerando el reporte de la grada…`
      : `FULL TIME · ${score}\nReporte listo: ${event.reportUrl}`;
    this.fullTimeText.visible = true;
    this.fullTimeBackground.visible = true;
    this.layout();
  }

  playMatchStarted(event: MatchStartedEvent): void {
    this.fullTime = false;
    this.fullTimeText.visible = false;
    this.fullTimeBackground.visible = false;
    this.setScoreboard(event.scoreBySide, false);
    this.lastTickAt = 0;
  }

  tick(now: number): void {
    if (this.fullTime) {
      this.lastTickAt = now;
      return;
    }
    const deltaSeconds = this.lastTickAt === 0 ? 1 / 60 : Math.min(0.05, (now - this.lastTickAt) / 1_000);
    this.lastTickAt = now;
    this.updateJoinLabelText(now);
    this.updateCounters(deltaSeconds);
    this.updateMood(deltaSeconds);
    this.animateSprites(now);
    this.animateConfetti(now);
    this.animateGoal(now);
    this.updateBanners(now);
    this.updateCrowdSound(now);
  }

  private makeGeometry(width: number, height: number): LayoutGeometry {
    const margin = Math.min(40, Math.max(16, width * 0.04));
    const panelY = 68;
    const panelWidth = Math.max(280, width - margin * 2);
    const panelHeight = Math.max(220, height - panelY - 28);
    return {
      panelX: margin,
      panelY,
      panelWidth,
      panelHeight,
      halfWidth: panelWidth / SIDES.length,
      seatTop: panelY + 106,
      seatBottom: panelY + panelHeight - 58,
      seatColumns: SEAT_COLUMNS,
      seatRows: SEAT_ROWS,
    };
  }

  private layout(): void {
    const { panelX, panelY, panelWidth, panelHeight, halfWidth } = this.geometry;
    this.panel.clear().roundRect(panelX, panelY, panelWidth, panelHeight, 22)
      .fill({ color: 0x081421, alpha: 0.84 })
      .stroke({ color: 0xffffff, alpha: 0.2, width: 2 });
    this.title.position.set(panelX + panelWidth / 2, 27);
    this.debugText.position.set(panelX + 10, 42);
    this.scoreboard.position.set(panelX + panelWidth / 2, panelY + 33);
    this.scoreboardBackground.clear()
      .roundRect(panelX + panelWidth / 2 - 142, panelY + 16, 284, 35, 12)
      .fill({ color: 0x081421, alpha: 0.88 })
      .stroke({ color: 0xffffff, alpha: 0.3, width: 1 });
    this.goalBanner.position.set(panelX + panelWidth / 2, panelY + panelHeight * 0.48);
    this.goalBannerBackground.clear();
    const bannerWidth = Math.min(panelWidth - 48, Math.max(300, this.goalBanner.width + 56));
    const bannerY = panelY + panelHeight * 0.48 - 48;
    const goalColor = this.goalAnimation ? SIDES.find((side) => side.id === this.goalAnimation?.side)?.primaryColor ?? 0x183153 : 0x183153;
    this.goalBannerBackground.roundRect(panelX + (panelWidth - bannerWidth) / 2, bannerY, bannerWidth, 96, 18)
      .fill({ color: goalColor, alpha: 0.93 })
      .stroke({ color: 0xffffff, alpha: 0.8, width: 3 });
    this.fullTimeText.position.set(panelX + panelWidth / 2, panelY + panelHeight * 0.48);
    this.fullTimeText.anchor.set(0.5);
    this.fullTimeBackground.clear();
    const fullTimeWidth = Math.min(panelWidth - 32, Math.max(320, this.fullTimeText.width + 48));
    this.fullTimeBackground.roundRect(panelX + (panelWidth - fullTimeWidth) / 2, panelY + panelHeight * 0.48 - 54, fullTimeWidth, 108, 18)
      .fill({ color: 0x081421, alpha: 0.96 })
      .stroke({ color: 0x8fe3ae, alpha: 0.95, width: 3 });

    for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex += 1) {
      const side = SIDES[sideIndex];
      if (!side) continue;
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      const sideStart = panelX + sideIndex * halfWidth;
      visuals.background.clear().roundRect(sideStart + 8, panelY + 8, halfWidth - 16, panelHeight - 16, 16)
        .fill({ color: side.primaryColor, alpha: 0.18 });
      visuals.header.anchor.set(0.5);
      visuals.header.position.set(sideStart + halfWidth / 2, panelY + 26);
      visuals.joinLabel.anchor.set(0.5);
      visuals.joinLabel.position.set(sideStart + halfWidth / 2, panelY + 52);
      const meterX = sideStart + 18;
      const meterY = panelY + panelHeight - 11;
      const meterWidth = halfWidth - 36;
      visuals.pressureTrack.clear().roundRect(meterX, meterY, meterWidth, 5, 2.5)
        .fill({ color: 0xffffff, alpha: 0.2 });
      visuals.pressureFill.clear().roundRect(0, 0, meterWidth, 5, 2.5)
        .fill({ color: 0xffffff });
      visuals.pressureFill.position.set(meterX, meterY);
      visuals.bannerText.anchor.set(0.5);
      visuals.bannerText.position.set(sideStart + halfWidth / 2, panelY + 83);
      visuals.bannerText.style.wordWrapWidth = Math.max(150, halfWidth - 50);
      visuals.bannerBackground.clear();
      const bannerWidth = Math.min(halfWidth - 32, Math.max(180, visuals.bannerText.width + 26));
      visuals.bannerBackground.roundRect(sideStart + (halfWidth - bannerWidth) / 2, panelY + 65, bannerWidth, 36, 9)
        .fill({ color: side.primaryColor, alpha: 0.9 });

      this.drawEmptySeats(visuals.seatMarkers, side.id);
      visuals.pressureTrack.alpha = 0.9;
      visuals.pressureFill.tint = visuals.meterColor;
      visuals.pressureFill.scale.set(visuals.visiblePressure, 1);
      this.drawOverflow(visuals, side.id, side.primaryColor, side.secondaryColor, sideStart, panelY, panelHeight, halfWidth);
    }
  }

  private drawEmptySeats(markers: Graphics, side: Side): void {
    markers.clear();
    const { panelX, halfWidth, seatTop, seatBottom, seatColumns, seatRows } = this.geometry;
    const sideIndex = SIDES.findIndex((candidate) => candidate.id === side);
    const sideStart = panelX + sideIndex * halfWidth;
    const cellWidth = (halfWidth - 30) / (seatColumns + 0.5);
    const rowHeight = (seatBottom - seatTop) / (seatRows - 1);
    for (let seat = 0; seat < seatColumns * seatRows; seat += 1) {
      const row = Math.floor(seat / seatColumns);
      const column = seat % seatColumns;
      const stagger = row % 2 === 1 ? 0.5 : 0;
      markers.circle(sideStart + 15 + cellWidth * (column + 0.5 + stagger), seatBottom - row * rowHeight + 7, 3)
        .fill({ color: 0xffffff, alpha: 0.065 });
    }
  }

  private drawOverflow(
    visuals: SideVisuals,
    side: Side,
    primaryColor: number,
    secondaryColor: number,
    sideStart: number,
    panelY: number,
    panelHeight: number,
    halfWidth: number,
  ): void {
    const overflow = this.state?.overflowCounts[side] ?? 0;
    const bandY = panelY + panelHeight - 40;
    visuals.overflowBackground.visible = overflow > 0;
    visuals.overflowLabel.visible = overflow > 0;
    visuals.overflowBackground.clear();
    if (overflow <= 0) return;

    visuals.overflowBackground.roundRect(sideStart + 18, bandY, halfWidth - 36, 29, 9)
      .fill({ color: primaryColor, alpha: 0.72 });
    for (let dot = 0; dot < 20; dot += 1) {
      const dotX = sideStart + 31 + (dot % 10) * ((halfWidth - 64) / 10);
      const dotY = bandY + 8 + Math.floor(dot / 10) * 9;
      visuals.overflowBackground.circle(dotX, dotY, 2.3)
        .fill({ color: dot % 2 === 0 ? secondaryColor : primaryColor, alpha: 0.9 });
    }
    visuals.overflowLabel.text = `+${overflow} en la grada`;
    visuals.overflowLabel.anchor.set(0.5);
    visuals.overflowLabel.position.set(sideStart + halfWidth / 2, bandY + 15);
  }

  private reconcileFan(fan: Fan, now: number, animateArrivals: boolean): void {
    const current = this.activeByUser.get(fan.userId);
    const currentSeatKey = current?.side !== undefined && current.seat !== undefined
      ? seatKey(current.side, current.seat)
      : undefined;
    const desiredSeatKey = seatKey(fan.side, fan.seat);

    if (current && currentSeatKey === desiredSeatKey && current.lifecycle === "active") {
      if (current.userName !== fan.userName) {
        current.userName = fan.userName;
        const side = SIDES.find((candidate) => candidate.id === fan.side);
        if (side) drawFan(current.graphic, fan, side.primaryColor, side.secondaryColor);
      }
      return;
    }
    if (current) this.beginDeparture(current, now);

    const occupant = this.seatOccupants.get(desiredSeatKey);
    if (occupant && occupant.lifecycle !== "free") {
      this.pendingBySeat.set(desiredSeatKey, fan);
      if (occupant.lifecycle === "active") this.beginDeparture(occupant, now);
      return;
    }

    this.activateFan(fan, this.takeSprite(), now, animateArrivals);
  }

  private activateFan(fan: Fan, sprite: FanSprite | undefined, now: number, animate: boolean): void {
    if (!sprite) return;
    const side = SIDES.find((candidate) => candidate.id === fan.side);
    if (!side) return;
    sprite.lifecycle = "active";
    sprite.userId = fan.userId;
    sprite.userName = fan.userName;
    sprite.side = fan.side;
    sprite.seat = fan.seat;
    sprite.bouncePhase = hashString(fan.userId) % 628 / 100;
    drawFan(sprite.graphic, fan, side.primaryColor, side.secondaryColor);
    this.positionSprite(sprite, fan.side, fan.seat);
    sprite.container.visible = true;
    sprite.animationKind = animate ? "enter" : undefined;
    sprite.animationStartedAt = now;
    sprite.animationDurationMs = animate ? ENTER_ANIMATION_MS : 0;
    if (animate) {
      sprite.container.alpha = 0;
      sprite.container.scale.set(sprite.depth * 0.55);
      sprite.container.position.y = sprite.baseY - 13;
    } else {
      sprite.container.alpha = 1;
      sprite.container.scale.set(sprite.depth);
    }
    this.activeByUser.set(fan.userId, sprite);
    this.seatOccupants.set(seatKey(fan.side, fan.seat), sprite);
  }

  private beginDeparture(sprite: FanSprite, now: number): void {
    if (sprite.lifecycle !== "active") return;
    if (sprite.userId) this.activeByUser.delete(sprite.userId);
    sprite.lifecycle = "leaving";
    sprite.animationKind = "leave";
    sprite.animationStartedAt = now;
    sprite.animationDurationMs = LEAVE_ANIMATION_MS;
    this.leavingSprites.add(sprite);
  }

  private takeSprite(): FanSprite | undefined {
    const reusable = this.freeSprites.pop();
    if (reusable) return reusable;
    if (this.fanPool.length >= FAN_POOL_CAP) return undefined;

    const container = new Container();
    const graphic = new Graphics();
    container.addChild(graphic);
    container.visible = false;
    this.fanLayer.addChild(container);
    const sprite: FanSprite = {
      container,
      graphic,
      lifecycle: "free",
      baseX: 0,
      baseY: 0,
      depth: 1,
      animationStartedAt: 0,
      animationDurationMs: 0,
      bouncePhase: 0,
    };
    this.fanPool.push(sprite);
    return sprite;
  }

  private positionSprite(sprite: FanSprite, side: Side, seat: number): void {
    const sideIndex = SIDES.findIndex((candidate) => candidate.id === side);
    const { panelX, halfWidth, seatBottom, seatTop, seatColumns, seatRows } = this.geometry;
    const row = Math.floor(seat / seatColumns);
    const column = seat % seatColumns;
    const sideStart = panelX + sideIndex * halfWidth;
    const cellWidth = (halfWidth - 30) / (seatColumns + 0.5);
    const rowHeight = (seatBottom - seatTop) / (seatRows - 1);
    const stagger = row % 2 === 1 ? 0.5 : 0;
    const jitterHash = hashString(`${side}:${seat}`);
    const jitterX = ((jitterHash & 0xff) / 255 - 0.5) * 4;
    const jitterY = (((jitterHash >>> 8) & 0xff) / 255 - 0.5) * 3;
    sprite.baseX = sideStart + 15 + cellWidth * (column + 0.5 + stagger) + jitterX;
    sprite.baseY = seatBottom - row * rowHeight + jitterY;
    sprite.depth = 1 - 0.3 * (row / (seatRows - 1));
    sprite.container.zIndex = sprite.baseY;
    sprite.container.position.set(sprite.baseX, sprite.baseY);
    if (!sprite.animationKind) sprite.container.scale.set(sprite.depth);
  }

  private animateSprites(now: number): void {
    for (const sprite of this.fanPool) {
      if (sprite.lifecycle === "free") continue;
      const progress = sprite.animationDurationMs === 0
        ? 1
        : Math.min(1, (now - sprite.animationStartedAt) / sprite.animationDurationMs);

      if (sprite.animationKind === "enter") {
        const eased = 1 - Math.pow(1 - progress, 3);
        sprite.container.alpha = eased;
        sprite.container.scale.set(sprite.depth * (0.55 + eased * 0.45));
        sprite.container.position.y = sprite.baseY - 13 * (1 - eased);
        if (progress >= 1) sprite.animationKind = undefined;
      } else if (sprite.animationKind === "leave") {
        sprite.container.alpha = 1 - progress;
        sprite.container.scale.set(sprite.depth * (1 - progress * 0.3));
        sprite.container.position.y = sprite.baseY + 12 * progress;
        if (progress >= 1) this.finishDeparture(sprite, now);
        continue;
      }

      const singing = sprite.side ? this.state?.singing[sprite.side] : null;
      const goal = this.goalAnimation;
      const visuals = sprite.side ? this.visuals.get(sprite.side) : undefined;
      const activeChant = singing && singing.endsAt > now;
      let goalBounce = 0;
      if (goal && goal.endsAt > now && sprite.animationKind === undefined) {
        const elapsed = now - goal.startedAt;
        if (sprite.side === goal.side) {
          const envelope = Math.max(0, 1 - elapsed / 1_400);
          goalBounce = Math.abs(Math.sin(elapsed * 0.018 + sprite.bouncePhase)) * 25 * envelope;
          sprite.container.alpha = 1;
        } else {
          sprite.container.alpha = 0.48;
        }
      } else if (sprite.animationKind === undefined && activeChant) {
        sprite.container.alpha = 1;
      } else if (sprite.animationKind === undefined) {
        sprite.container.alpha = 1 - (visuals?.moodDim ?? 0);
      }
      const chantBounce = activeChant
        ? Math.abs(Math.sin(now * (0.008 + singing.intensity * 0.009) + sprite.bouncePhase)) * (2 + 8 * singing.intensity)
        : 0;
      const slump = goal && goal.endsAt > now && sprite.side !== goal.side ? 5 : 0;
      const moodEnergy = visuals?.moodEnergy ?? 0.45;
      const idleFrequency = 0.002 + moodEnergy * 0.006;
      const idleBob = Math.sin(now * idleFrequency + sprite.bouncePhase) * (0.8 + moodEnergy * 4);
      const moodSlump = (1 - moodEnergy) * 4;
      if (!sprite.animationKind) {
        if (goal && goal.endsAt > now) {
          sprite.container.position.y = sprite.baseY + slump - goalBounce - chantBounce;
        } else if (activeChant) {
          sprite.container.position.y = sprite.baseY - chantBounce;
        } else {
          sprite.container.position.y = sprite.baseY + moodSlump - idleBob;
          sprite.container.scale.set(sprite.depth, sprite.depth * (1 + moodEnergy * Math.abs(idleBob) * 0.012));
        }
      }
    }
  }

  private setMoodTarget(visuals: SideVisuals, pressure: PressureState): void {
    visuals.targetPressure = Math.max(0, Math.min(1, pressure.value));
    visuals.targetMood = pressure.mood;
    visuals.targetEnergy = pressure.mood === "cold" ? 0.08 : pressure.mood === "hot" ? 1 : 0.42;
    visuals.targetDim = pressure.mood === "cold" ? 0.32 : 0;
    visuals.targetSeatVisibility = pressure.mood === "cold" ? 0.9 : pressure.mood === "hot" ? 0.22 : 0.38;
    visuals.targetMeterColor = pressure.mood === "cold" ? 0x5ba6c2 : pressure.mood === "hot" ? 0xff8d3b : 0x71ca93;
  }

  private updateMood(deltaSeconds: number): void {
    const tween = 1 - Math.exp(-deltaSeconds / 1);
    const goalActive = this.goalAnimation !== undefined && this.goalAnimation.endsAt > Date.now();
    for (const side of SIDES) {
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      visuals.visiblePressure += (visuals.targetPressure - visuals.visiblePressure) * tween;
      visuals.moodEnergy += (visuals.targetEnergy - visuals.moodEnergy) * tween;
      visuals.moodDim += (visuals.targetDim - visuals.moodDim) * tween;
      visuals.seatVisibility += (visuals.targetSeatVisibility - visuals.seatVisibility) * tween;
      visuals.meterColor = mixColor(visuals.meterColor, visuals.targetMeterColor, tween);
      visuals.pressureFill.scale.x = visuals.visiblePressure;
      visuals.pressureFill.tint = visuals.meterColor;
      visuals.background.alpha = goalActive ? (this.goalAnimation?.side === side.id ? 1 : 0.62) : 0.65 + visuals.moodEnergy * 0.35;
      visuals.seatMarkers.alpha = goalActive ? 0.24 : visuals.seatVisibility;
    }
  }

  private setScoreboard(score: Record<Side, number>, animate: boolean): void {
    const next = `${SIDES[0]?.name ?? "Argentina"} ${score.argentina}  -  ${score.mexico} ${SIDES[1]?.name ?? "Mexico"}`;
    if (this.scoreboard.text === next) return;
    this.scoreboard.text = next;
    if (animate) this.scoreboardScaleStartedAt = Date.now();
    this.layout();
  }

  private spawnConfetti(side: Side, now: number): void {
    const sideIndex = SIDES.findIndex((candidate) => candidate.id === side);
    const centerX = this.geometry.panelX + this.geometry.halfWidth * (sideIndex + 0.5);
    const colors = [
      SIDES[sideIndex]?.primaryColor ?? 0xffffff,
      SIDES[sideIndex]?.secondaryColor ?? 0xffffff,
      0xffffff,
    ];
    for (const particle of this.confetti) {
      const color = colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff;
      const size = 4 + Math.random() * 8;
      particle.graphic.clear().roundRect(-size / 2, -size / 2, size, size * (0.7 + Math.random()), 1).fill({ color });
      particle.graphic.position.set(centerX + (Math.random() - 0.5) * this.geometry.halfWidth * 0.9, this.geometry.panelY - 20);
      particle.graphic.rotation = Math.random() * Math.PI;
      particle.graphic.alpha = 1;
      particle.graphic.visible = true;
      particle.startedAt = now;
      particle.durationMs = 2_700 + Math.random() * 1_400;
      particle.velocityX = (Math.random() - 0.5) * 5;
      particle.velocityY = -3 - Math.random() * 6;
      particle.rotationSpeed = (Math.random() - 0.5) * 0.24;
      particle.active = true;
    }
  }

  private animateConfetti(now: number): void {
    for (const particle of this.confetti) {
      if (!particle.active) continue;
      const elapsed = now - particle.startedAt;
      if (elapsed >= particle.durationMs) {
        particle.active = false;
        particle.graphic.visible = false;
        continue;
      }
      particle.graphic.x += particle.velocityX;
      particle.graphic.y += particle.velocityY;
      particle.velocityY += 0.16;
      particle.graphic.rotation += particle.rotationSpeed;
      particle.graphic.alpha = Math.min(1, (particle.durationMs - elapsed) / 600);
    }
  }

  private animateGoal(now: number): void {
    if (this.scoreboardScaleStartedAt > 0) {
      const elapsed = now - this.scoreboardScaleStartedAt;
      if (elapsed >= 460) {
        this.scoreboard.scale.set(1);
        this.scoreboardScaleStartedAt = 0;
      } else {
        const pulse = 1 + Math.sin((elapsed / 460) * Math.PI) * 0.2;
        this.scoreboard.scale.set(pulse);
      }
    }
    const goal = this.goalAnimation;
    if (!goal) return;
    const remaining = goal.endsAt - now;
    if (remaining <= 0) {
      this.goalAnimation = undefined;
      this.goalBanner.visible = false;
      this.goalBannerBackground.visible = false;
      return;
    }
    const progress = (now - goal.startedAt) / GOAL_ANIMATION_MS;
    this.goalBanner.alpha = remaining < 900 ? remaining / 900 : 1;
    this.goalBannerBackground.alpha = this.goalBanner.alpha;
    this.goalBanner.scale.set(0.65 + Math.min(1, progress * 4) * 0.35);
  }

  private playGoalSound(): void {
    if (this.muted || !this.audioContext) return;
    if (this.audioContext.state === "suspended") void this.audioContext.resume().catch(() => undefined);
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.setValueAtTime(720, now + 0.2);
    oscillator.frequency.setValueAtTime(880, now + 0.42);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.92);
  }

  private finishDeparture(sprite: FanSprite, now: number): void {
    const key = sprite.side !== undefined && sprite.seat !== undefined ? seatKey(sprite.side, sprite.seat) : undefined;
    if (key && this.seatOccupants.get(key) === sprite) this.seatOccupants.delete(key);
    this.leavingSprites.delete(sprite);
    sprite.lifecycle = "free";
    sprite.animationKind = undefined;
    sprite.userId = undefined;
    sprite.userName = undefined;
    sprite.side = undefined;
    sprite.seat = undefined;
    sprite.container.visible = false;
    sprite.container.alpha = 1;
    const pending = key ? this.pendingBySeat.get(key) : undefined;
    if (pending && this.state?.fans.some((fan) => fan.userId === pending.userId && seatKey(fan.side, fan.seat) === key)) {
      this.pendingBySeat.delete(key!);
      this.activateFan(pending, sprite, now, true);
    } else {
      this.freeSprites.push(sprite);
    }
  }

  private updateCounters(deltaSeconds: number): void {
    for (const side of SIDES) {
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      const difference = visuals.targetCount - visuals.displayedCount;
      visuals.displayedCount += difference * Math.min(1, deltaSeconds * 7);
      if (Math.abs(difference) < 0.05) visuals.displayedCount = visuals.targetCount;
      visuals.header.text = `${side.name}  ·  ${Math.round(visuals.displayedCount)}`;
    }
  }

  private updateJoinLabelText(now: number): void {
    for (const side of SIDES) {
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      const names = (this.state?.recentJoins ?? [])
        .filter((join) => join.side === side.id && now - join.timestamp <= JOIN_LABEL_MS)
        .slice(-3)
        .map((join) => join.userName);
      visuals.joinLabel.text = names.length > 0 ? `Se unieron: ${names.join(" · ")}` : "";
    }
  }

  private setBanner(side: Side, singing: { text: string; intensity: number; endsAt: number }, now: number, durationMs?: number): void {
    const visuals = this.visuals.get(side);
    if (!visuals) return;
    visuals.bannerText.text = singing.text;
    visuals.bannerEndsAt = singing.endsAt;
    visuals.bannerDurationMs = durationMs ?? Math.max(500, singing.endsAt - now);
    visuals.bannerIntensity = singing.intensity;
    visuals.bannerText.visible = true;
    visuals.bannerBackground.visible = true;
    this.layout();
  }

  private updateBanners(now: number): void {
    for (const side of SIDES) {
      const visuals = this.visuals.get(side.id);
      if (!visuals) continue;
      const remaining = visuals.bannerEndsAt - now;
      const alpha = remaining <= 0 ? 0 : Math.min(1, remaining / Math.min(1_400, visuals.bannerDurationMs));
      visuals.bannerText.alpha = alpha;
      visuals.bannerBackground.alpha = alpha;
      visuals.bannerText.visible = remaining > 0;
      visuals.bannerBackground.visible = remaining > 0;
    }
  }

  private startProceduralCrowdSound(): void {
    try {
      const context = new AudioContext();
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < channel.length; index += 1) channel[index] = (Math.random() * 2 - 1) * 0.5;

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 850;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      this.audioContext = context;
      this.noiseGain = gain;
      void context.resume().catch(() => undefined);
    } catch {
      this.audioContext = undefined;
      this.noiseGain = undefined;
    }
  }

  private updateCrowdSound(now: number): void {
    if (this.muted || !this.audioContext || !this.noiseGain) return;
    let intensity = 0;
    for (const side of SIDES) {
      const singing = this.state?.singing[side.id];
      if (singing && singing.endsAt > now) intensity = Math.max(intensity, singing.intensity);
    }
    const target = intensity > 0 ? 0.015 + intensity * 0.075 : 0;
    if (Math.abs(target - this.lastAudioTarget) < 0.005) return;
    this.lastAudioTarget = target;
    this.noiseGain.gain.setTargetAtTime(target, this.audioContext.currentTime, target > 0 ? 0.18 : 0.65);
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

function seatKey(side: Side, seat: number): string {
  return `${side}:${seat}`;
}

function mixColor(current: number, target: number, amount: number): number {
  const clamped = Math.max(0, Math.min(1, amount));
  const currentRed = (current >> 16) & 0xff;
  const currentGreen = (current >> 8) & 0xff;
  const currentBlue = current & 0xff;
  const targetRed = (target >> 16) & 0xff;
  const targetGreen = (target >> 8) & 0xff;
  const targetBlue = target & 0xff;
  const red = Math.round(currentRed + (targetRed - currentRed) * clamped);
  const green = Math.round(currentGreen + (targetGreen - currentGreen) * clamped);
  const blue = Math.round(currentBlue + (targetBlue - currentBlue) * clamped);
  return (red << 16) | (green << 8) | blue;
}
