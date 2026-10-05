import { DEFAULT_SHAKE, ShakeDetector } from './shake';

const REST = { x: 0, y: 0, z: 1 };
const JOLT = { x: 2.5, y: 1.5, z: 0.5 }; // magnitude ~3 g

/** Feeds `n` jolts spaced `gap` ms apart starting at `start`; returns whether any fired. */
function shake(d: ShakeDetector, n: number, gap: number, start = 0): boolean[] {
  return Array.from({ length: n }, (_, i) => d.feed({ ...JOLT, t: start + i * gap }));
}

describe('ShakeDetector', () => {
  it('ignores a phone at rest and gentle movement', () => {
    const d = new ShakeDetector();
    for (let t = 0; t < 5000; t += 20) expect(d.feed({ ...REST, t })).toBe(false);
    for (let t = 0; t < 5000; t += 20) expect(d.feed({ x: 0.3, y: 0.2, z: 1.2, t })).toBe(false);
  });

  it('fires on a deliberate shake of several quick jolts', () => {
    const d = new ShakeDetector();
    const results = shake(d, DEFAULT_SHAKE.jolts, 200);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[results.length - 1]).toBe(true);
  });

  it('does not fire for one or two knocks', () => {
    const d = new ShakeDetector();
    expect(shake(d, 2, 200).some(Boolean)).toBe(false);
  });

  it('does not fire when jolts are spread too thin', () => {
    const d = new ShakeDetector();
    expect(shake(d, 6, 700).some(Boolean)).toBe(false);
  });

  it('counts one hard knock that rings for a moment as a single jolt', () => {
    const d = new ShakeDetector();
    const ringing = Array.from({ length: 20 }, (_, i) => d.feed({ ...JOLT, t: i * 10 }));
    expect(ringing.some(Boolean)).toBe(false);
  });

  it('fires only once for continued shaking, then again after the cooldown', () => {
    const d = new ShakeDetector();
    expect(shake(d, 20, 200).filter(Boolean)).toHaveLength(1);
    // 20 jolts * 200ms = 4s of shaking; the cooldown is 3s, so a second shake can land late in it.
    const later = shake(d, DEFAULT_SHAKE.jolts, 200, 10_000);
    expect(later.filter(Boolean)).toHaveLength(1);
  });

  it('can be reset', () => {
    const d = new ShakeDetector();
    shake(d, 3, 200);
    d.reset();
    expect(d.feed({ ...JOLT, t: 700 })).toBe(false);
  });
});
