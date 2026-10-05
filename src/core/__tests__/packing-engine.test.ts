import { describe, expect, it } from 'vitest';
import { packItems, validateItem, validateSuitcase } from '../packing-engine';
import type { PackingItem, Suitcase } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ length: 10, width: 8, height: 6, maxWeight: 10, ...overrides });
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 1, quantity: 1, priority: 2, mustHave: false, ...overrides,
});

describe('validateSuitcase', () => {
  it('rejects each non-positive capacity', () => {
    expect(validateSuitcase(suitcase({ height: 0 }))).toContain('行李箱高度必须大于 0');
    expect(validateSuitcase(suitcase({ maxWeight: -1 }))).toContain('承重必须大于 0');
  });
});

describe('validateItem', () => {
  it('rejects zero, negative and decimal quantities', () => {
    expect(validateItem(item('a', { quantity: 0 }))).toContain('数量必须是大于 0 的整数');
    expect(validateItem(item('a', { quantity: -2 }))).toContain('数量必须是大于 0 的整数');
    expect(validateItem(item('a', { quantity: 1.5 }))).toContain('数量必须是大于 0 的整数');
    expect(validateItem(item('a', { quantity: 3 }))).toEqual([]);
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
    expect(new Set(plan.placements.map((p) => `${p.itemId}#${p.instanceIndex}:${p.x}:${p.y}:${p.z}`)).size).toBe(3);
  });

  it('returns deterministic coordinates and an unplaced reason', () => {
    const inputs = [item('a'), item('huge', { length: 30 })];
    expect(packItems(suitcase(), inputs, 'comfort')).toEqual(packItems(suitcase(), inputs, 'comfort'));
    expect(packItems(suitcase(), inputs, 'comfort').unplaced[0]?.reason).toContain('空间');
  });

  it('packs each copy independently with stable instance indexes, weight and volume', () => {
    const plan = packItems(suitcase(), [item('triple', { quantity: 3 })], 'comfort');
    expect(plan.placements.map((p) => p.instanceIndex)).toEqual([0, 1, 2]);
    expect(plan.placements.every((p) => p.itemId === 'triple')).toBe(true);
    expect(plan.totalWeight).toBe(3);
    expect(plan.usedVolume).toBe(3 * 2 * 1 * 3);
    expect(plan.itemSummaries).toEqual([{ itemId: 'triple', quantity: 3, packedCount: 3, unpackedCount: 0 }]);
  });

  it('reports packed and unpacked copies per kind when weight cap is hit', () => {
    const plan = packItems(suitcase({ maxWeight: 2 }), [item('pair', { quantity: 5 })], 'comfort');
    expect(plan.placements).toHaveLength(2);
    expect(plan.unplaced.map((entry) => entry.instanceIndex)).toEqual([2, 3, 4]);
    expect(plan.itemSummaries).toEqual([{ itemId: 'pair', quantity: 5, packedCount: 2, unpackedCount: 3 }]);
  });
});
