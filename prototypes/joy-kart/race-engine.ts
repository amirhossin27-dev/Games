import * as P from './physics';

export type Phase = 'ready' | 'countdown' | 'racing' | 'paused' | 'finished';
export interface RaceOptions { mode?: 'solo' | 'cpu'; assist?: boolean; seed?: number }
export const FIXED_STEP = 1 / 120;

/** Isolated prototype controller. All vehicle movement and lap rules come from Arta. */
export class KartRace {
  readonly track = P.getTrack();
  readonly mode: 'solo' | 'cpu';
  assist: boolean;
  human!: P.KartState;
  rival: P.KartState | null = null;
  course!: P.Course;
  phase: Phase = 'ready';
  elapsed = 0;
  countdown = P.COUNTDOWN;
  private previousPhase: Phase = 'racing';
  private accumulator = 0;
  private boostQueued = false;
  private wasOffRoad = false;
  private random: () => number;
  private seed: number;
  private eventQueue: string[] = [];

  constructor(options: RaceOptions = {}) {
    this.mode = options.mode === 'solo' ? 'solo' : 'cpu';
    this.assist = options.assist !== false;
    this.seed = options.seed ?? 741;
    this.random = P.seeded(this.seed);
    this.reset();
  }

  reset() {
    this.random = P.seeded(this.seed);
    this.human = P.newKart(this.track, this.mode === 'solo' ? 0 : 15);
    this.human.item = 'pilz';
    this.rival = this.mode === 'cpu' ? P.newKart(this.track, -15) : null;
    this.course = P.newCourse(this.track);
    this.phase = 'ready';
    this.previousPhase = 'racing';
    this.elapsed = 0;
    this.countdown = P.COUNTDOWN;
    this.accumulator = 0;
    this.boostQueued = false;
    this.wasOffRoad = false;
    this.eventQueue = [];
  }

  begin() { this.reset(); this.phase = 'countdown'; }
  pause() {
    if (this.phase !== 'racing' && this.phase !== 'countdown') return;
    this.previousPhase = this.phase;
    this.phase = 'paused';
    this.accumulator = 0;
    this.boostQueued = false;
  }
  resume() {
    if (this.phase !== 'paused') return;
    this.phase = this.previousPhase;
    this.accumulator = 0;
  }
  queueBoost() {
    if (this.phase === 'racing' && this.human.item === 'pilz') this.boostQueued = true;
  }

  /** The recovery action changes position, never earned progress or lap count. */
  returnToRoad() {
    const k = this.human;
    const p = P.trackPoint(this.track, k.s, 0);
    k.x = p.x; k.y = p.y; k.a = p.a; k.lat = 0; k.lane = 0;
    k.v = Math.min(k.v, 60); k.st = 0; k.spin = 0; k.boost = 0;
    k.drift = 0; k.driftDir = 0; k.hold = 0; k.holdDir = 0; k.grace = 0; k.wrong = 0;
    k.seg = P.locate(this.track, k.x, k.y).i;
    this.boostQueued = false;
    this.wasOffRoad = false;
  }

  /** Fixed simulation ticks keep driving independent of the rendering frame rate. */
  advance(seconds: number, steer = 0) {
    if (this.phase !== 'countdown' && this.phase !== 'racing') return;
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const direction = Number.isFinite(steer) ? Math.max(-1, Math.min(1, steer)) : 0;
    this.accumulator += Math.min(seconds, 0.25);
    while (this.accumulator + 1e-10 >= FIXED_STEP) {
      this.accumulator -= FIXED_STEP;
      if (this.phase === 'countdown') {
        this.countdown = Math.max(0, this.countdown - FIXED_STEP);
        if (this.countdown <= 1e-8) { this.countdown = 0; this.phase = 'racing'; this.eventQueue.push('go'); }
        continue;
      }
      this.tick(direction);
      if (this.phase !== 'racing') { this.accumulator = 0; break; }
    }
  }

  private tick(steer: number) {
    this.elapsed += FIXED_STEP;
    P.tickCourse(this.course, FIXED_STEP);
    const input = this.assist ? P.assistInput(this.human, this.track, steer, FIXED_STEP) : { steer, use: false };
    input.use = this.boostQueued;
    this.boostQueued = false;
    const events: P.KartEvent[] = [];
    P.stepKart(this.human, input, FIXED_STEP, this.track, this.elapsed, events, {
      rnd: this.random, course: this.course, leading: !this.rival || P.ahead(this.human, this.rival), solo: true,
    });
    if (this.rival && this.rival.fin === null) {
      const rivalEvents: P.KartEvent[] = [];
      const rivalInput = P.kiInput(this.rival, this.track, this.human, this.random, FIXED_STEP);
      P.stepKart(this.rival, rivalInput, FIXED_STEP, this.track, this.elapsed, rivalEvents, {
        rnd: this.random, course: this.course, leading: P.ahead(this.rival, this.human), solo: true,
        vmaxMul: P.kiVmax(this.rival, this.human) * 0.96,
      });
      P.bump(this.human, this.rival.x, this.rival.y, 0.5);
      P.bump(this.rival, this.human.x, this.human.y, 0.5);
    }
    const offRoad = !P.onRoad(this.human);
    if (offRoad && !this.wasOffRoad) events.push('wall');
    this.wasOffRoad = offRoad;
    this.eventQueue.push(...events);
    if (this.human.fin !== null) this.phase = 'finished';
  }

  takeEvents() { const events = this.eventQueue; this.eventQueue = []; return events; }
  get place() { return !this.rival || P.ahead(this.human, this.rival) ? 1 : 2; }
  get speedKmh() { return Math.round(this.human.v * 0.432); }
  get progress() { return Math.max(0, Math.min(1, this.human.prog / (P.LAPS * this.track.len))); }
}
