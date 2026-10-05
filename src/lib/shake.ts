export interface Sample {
  x: number;
  y: number;
  z: number;
  /** Milliseconds, any monotonic clock. */
  t: number;
}

export interface ShakeOptions {
  /** How far the total acceleration must stray from 1 g (gravity) to count as a jolt. */
  threshold: number;
  /** Jolts needed within the window. */
  jolts: number;
  windowMs: number;
  /** Jolts closer together than this are one jolt (a single hard knock rings for a moment). */
  minGapMs: number;
  /** After firing, ignore everything for this long so one shake opens one dialog. */
  cooldownMs: number;
}

export const DEFAULT_SHAKE: ShakeOptions = {
  threshold: 1.6,
  jolts: 4,
  windowMs: 1200,
  minGapMs: 100,
  cooldownMs: 3000,
};

/**
 * Detects a deliberate shake from accelerometer samples (in g). Requires several strong jolts
 * in quick succession, so walking, a bumpy stroller or dropping the phone on a table don't
 * trigger it, and goes quiet after firing so repeated shaking opens a single dialog.
 */
export class ShakeDetector {
  private jolts: number[] = [];
  private lastJolt = -Infinity;
  private quietUntil = -Infinity;

  constructor(private readonly options: ShakeOptions = DEFAULT_SHAKE) {}

  /** Feed one sample; returns true on the sample that completes a shake. */
  feed({ x, y, z, t }: Sample): boolean {
    if (t < this.quietUntil) return false;

    const magnitude = Math.sqrt(x * x + y * y + z * z);
    if (Math.abs(magnitude - 1) < this.options.threshold) return false;
    if (t - this.lastJolt < this.options.minGapMs) return false;

    this.lastJolt = t;
    this.jolts = this.jolts.filter((time) => t - time <= this.options.windowMs);
    this.jolts.push(t);

    if (this.jolts.length >= this.options.jolts) {
      this.jolts = [];
      this.quietUntil = t + this.options.cooldownMs;
      return true;
    }
    return false;
  }

  reset(): void {
    this.jolts = [];
    this.lastJolt = -Infinity;
    this.quietUntil = -Infinity;
  }
}
