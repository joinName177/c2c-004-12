import { describe, expect, it } from 'vitest';
import { instanceId, instanceLabel, itemVolume, suitcaseVolume, totalInstanceCount, totalPlannedWeight, type PackingItem, type Suitcase } from '../models';

describe('volume helpers', () => {
  it('multiplies an item dimensions in centimeters', () => {
    const item = { length: 10, width: 4, height: 3 } as PackingItem;
    expect(itemVolume(item)).toBe(120);
  });

  it('multiplies suitcase internal dimensions', () => {
    const suitcase = { length: 50, width: 30, height: 20 } as Suitcase;
    expect(suitcaseVolume(suitcase)).toBe(30_000);
  });
});

describe('instance helpers', () => {
  it('builds stable instance identities and labels', () => {
    expect(instanceId('coat', 2)).toBe('coat#2');
    expect(instanceLabel('外套', 0, 1)).toBe('外套');
    expect(instanceLabel('外套', 1, 3)).toBe('外套 第2件');
  });

  it('totals planned copies and their combined weight', () => {
    const items = [
      { quantity: 3, weight: 0.5 },
      { quantity: 2, weight: 1.25 },
    ] as PackingItem[];
    expect(totalInstanceCount(items)).toBe(5);
    expect(totalPlannedWeight(items)).toBeCloseTo(4);
  });
});
