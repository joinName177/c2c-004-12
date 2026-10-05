import { describe, expect, it } from 'vitest';
import { migrateSnapshot } from '../snapshot-migration';
import type { PackingSnapshot } from '../models';

const baseSnapshot = (items: unknown[]): PackingSnapshot => ({
  suitcase: { length: 52, width: 35, height: 23, maxWeight: 10 },
  items: items as PackingSnapshot['items'],
  selectedPlan: 'comfort',
});

describe('migrateSnapshot', () => {
  it('defaults missing quantity on legacy records to one', () => {
    const legacy = baseSnapshot([
      { id: 'a', name: '旧物品', category: '衣物', length: 10, width: 5, height: 2, weight: 0.3, priority: 2, mustHave: false },
    ]);
    const result = migrateSnapshot(legacy);
    expect(result.snapshot.items[0]?.quantity).toBe(1);
    expect(result.warning).toContain('默认');
  });

  it('repairs zero, negative and decimal quantities instead of keeping them', () => {
    const raw = baseSnapshot([
      { id: 'zero', name: '零', quantity: 0 },
      { id: 'neg', name: '负', quantity: -3 },
      { id: 'frac', name: '小数', quantity: 2.5 },
      { id: 'ok', name: '正常', quantity: 4 },
    ]);
    const result = migrateSnapshot(raw);
    expect(result.snapshot.items.map((item) => item.quantity)).toEqual([1, 1, 1, 4]);
    expect(result.warning).toContain('非法数量');
  });

  it('passes valid snapshots through without a warning', () => {
    const valid = baseSnapshot([{ id: 'ok', quantity: 3 }]);
    const result = migrateSnapshot(valid);
    expect(result.snapshot.items[0]?.quantity).toBe(3);
    expect(result.warning).toBeUndefined();
  });

  it('falls back to sample data when the structure is unreadable', () => {
    const result = migrateSnapshot({ unexpected: true });
    expect(result.snapshot.items.length).toBeGreaterThan(0);
    expect(result.warning).toContain('无法读取');
  });

  it('defaults a missing selected plan to comfort', () => {
    const raw = { suitcase: {}, items: [] };
    expect(migrateSnapshot(raw).snapshot.selectedPlan).toBe('comfort');
  });
});
