import { describe, expect, it } from 'vitest';
import { packItems, validateSuitcase } from '../packing-engine';
import { initialCopies } from '../item-copies';
import type { PackingItem, Suitcase } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ length: 10, width: 8, height: 6, maxWeight: 10, ...overrides });
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 1, priority: 2, mustHave: false, quantity: 1, copies: initialCopies(id, 1), ...overrides,
});

describe('validateSuitcase', () => {
  it('rejects each non-positive capacity', () => {
    expect(validateSuitcase(suitcase({ height: 0 }))).toContain('行李箱高度必须大于 0');
    expect(validateSuitcase(suitcase({ maxWeight: -1 }))).toContain('承重必须大于 0');
  });
});

describe('packItems', () => {
  it('allows total weight exactly at the suitcase limit', () => {
    const plan = packItems(suitcase({ maxWeight: 2 }), [item('a'), item('b')], 'comfort');
    expect(plan.placements).toHaveLength(2);
    expect(plan.totalWeight).toBe(2);
  });

  it('uses rotation when the original orientation does not fit', () => {
    const plan = packItems(suitcase({ length: 4, width: 3, height: 2 }), [item('rotated', { length: 2, width: 4, height: 3 })], 'comfort');
    expect(plan.placements[0]?.dimensions).toEqual({ length: 4, width: 3, height: 2 });
  });

  it('keeps placements inside bounds and non-overlapping', () => {
    const plan = packItems(suitcase(), [item('a'), item('b'), item('c')], 'comfort');
    expect(plan.placements.every((p) => p.x + p.dimensions.length <= 10 && p.y + p.dimensions.width <= 8 && p.z + p.dimensions.height <= 6)).toBe(true);
    expect(new Set(plan.placements.map((p) => p.copyId)).size).toBe(3);
  });

  it('returns deterministic coordinates and an unplaced reason', () => {
    const inputs = [item('a'), item('huge', { length: 30 })];
    expect(packItems(suitcase(), inputs, 'comfort')).toEqual(packItems(suitcase(), inputs, 'comfort'));
    expect(packItems(suitcase(), inputs, 'comfort').unplaced[0]?.reason).toContain('空间');
  });

  it('packs every copy independently so weight and volume are charged per piece', () => {
    const plan = packItems(suitcase({ maxWeight: 2 }), [item('pair', { quantity: 3, copies: initialCopies('pair', 3) })], 'comfort');
    expect(plan.placements.map((p) => p.copyId)).toEqual(['pair#1', 'pair#2']);
    expect(plan.totalWeight).toBe(2);
    expect(plan.usedVolume).toBe(12);
    expect(plan.unplaced.map((entry) => entry.copyId)).toEqual(['pair#3']);
  });

  it('keeps copies of the same kind contiguous and ordered by fixed sequence', () => {
    const plan = packItems(suitcase(), [
      item('other', { priority: 1 }),
      item('pair', { priority: 3, quantity: 3, copies: initialCopies('pair', 3) }),
    ], 'comfort');
    expect(plan.placements.map((p) => p.itemId)).toEqual(['pair', 'pair', 'pair', 'other']);
  });
});
