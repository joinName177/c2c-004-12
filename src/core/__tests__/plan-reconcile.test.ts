import { describe, expect, it } from 'vitest';
import { buildItemSummaries, reconcilePlanForItems, reconcilePlanForQuantity, retainInstanceIndexes, selectSurvivorIndexes } from '../plan-reconcile';
import type { PackingItem, PackingPlan } from '../models';

const item = (id: string, quantity: number): PackingItem => ({
  id, name: id, category: '衣物', length: 2, width: 2, height: 2, weight: 1, quantity, priority: 2, mustHave: false,
});
const placement = (itemId: string, instanceIndex: number, x = 0) => ({ itemId, instanceIndex, x, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } });
const unplaced = (source: PackingItem, instanceIndex: number) => ({ item: source, instanceIndex, reason: '空间不足' });
const plan = (overrides: Partial<PackingPlan> = {}): PackingPlan => ({ id: 'comfort', name: '舒适版', placements: [], unplaced: [], itemSummaries: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0, ...overrides });

describe('retainInstanceIndexes', () => {
  it('removes unpacked copies before packed copies', () => {
    // 5 件：0、2 已装入；1、3、4 未装入 → 减到 2 件应保留两个已装入身份
    const retained = retainInstanceIndexes(5, 2, new Set([0, 2]));
    expect(retained.packed).toEqual([0, 2]);
    expect(retained.unpacked).toEqual([]);
  });

  it('removes packed copies in fixed descending order once unpacked copies are gone', () => {
    // 5 件全部已装入 → 减到 3 件时固定撤掉 4、3，保留 0、1、2
    expect(retainInstanceIndexes(5, 3, new Set([0, 1, 2, 3, 4])).packed).toEqual([0, 1, 2]);
  });

  it('keeps the lower unpacked copy when only unpacked copies are removed', () => {
    // 4 件：0、1 已装入，2、3 未装入 → 减到 3 件：撤大号未装入 3，保留 2 仍为未装入
    const retained = retainInstanceIndexes(4, 3, new Set([0, 1]));
    expect(retained.packed).toEqual([0, 1]);
    expect(retained.unpacked).toEqual([2]);
  });

  it('mixes unpacked-first removal then packed removal deterministically', () => {
    // 4 件：0、1、2 已装入，3 未装入 → 减到 1 件：先撤 3，再从大号撤已装入 2、1
    const retained = retainInstanceIndexes(4, 1, new Set([0, 1, 2]));
    expect(retained.packed).toEqual([0]);
    expect(retained.unpacked).toEqual([]);
  });

  it('keeps every identity when quantity grows or stays the same', () => {
    expect(retainInstanceIndexes(2, 4, new Set([0]))).toEqual({ packed: [0], unpacked: [1] });
    expect(retainInstanceIndexes(3, 3, new Set([0, 2]))).toEqual({ packed: [0, 2], unpacked: [1] });
  });
});

describe('reconcilePlanForQuantity', () => {
  it('prunes unpacked copies first and preserves packed identities on decrease', () => {
    const source = item('coat', 5);
    const before = plan({
      placements: [placement('coat', 0, 0), placement('coat', 2, 4)],
      unplaced: [unplaced(source, 1), unplaced(source, 3), unplaced(source, 4)],
      totalWeight: 2,
      usedVolume: 16,
    });
    const next = reconcilePlanForQuantity(before, [item('coat', 2)], 'coat', 5, 2);
    expect(next.placements.map((p) => p.instanceIndex)).toEqual([0, 2]);
    expect(next.unplaced).toEqual([]);
    expect(next.totalWeight).toBe(2);
    expect(next.itemSummaries).toEqual([{ itemId: 'coat', quantity: 2, packedCount: 2, unpackedCount: 0 }]);
  });

  it('prunes packed copies from the highest index when more copies must go', () => {
    const source = item('book', 4);
    const before = plan({
      placements: [placement('book', 0), placement('book', 1, 3), placement('book', 2, 6)],
      unplaced: [unplaced(source, 3)],
      totalWeight: 3,
      usedVolume: 24,
    });
    const next = reconcilePlanForQuantity(before, [item('book', 1)], 'book', 4, 1);
    expect(next.placements.map((p) => p.instanceIndex)).toEqual([0]);
    expect(next.itemSummaries[0]).toEqual({ itemId: 'book', quantity: 1, packedCount: 1, unpackedCount: 0 });
  });

  it('marks added copies as unpacked and leaves existing placements untouched', () => {
    const before = plan({ placements: [placement('hat', 0)], totalWeight: 1, usedVolume: 8 });
    const next = reconcilePlanForQuantity(before, [item('hat', 3)], 'hat', 1, 3);
    expect(next.placements.map((p) => p.instanceIndex)).toEqual([0]);
    expect(next.unplaced.map((entry) => entry.instanceIndex)).toEqual([1, 2]);
    expect(next.itemSummaries[0]).toEqual({ itemId: 'hat', quantity: 3, packedCount: 1, unpackedCount: 2 });
  });

  it('never changes the identities of copies belonging to other item kinds', () => {
    const coatSource = item('coat', 1);
    const before = plan({ placements: [placement('coat', 0), placement('scarf', 0, 3)], unplaced: [unplaced(coatSource, 0)] });
    const next = reconcilePlanForQuantity(before, [item('coat', 1), item('scarf', 2)], 'scarf', 1, 2);
    expect(next.placements.map((p) => `${p.itemId}#${p.instanceIndex}`)).toEqual(['coat#0', 'scarf#0']);
  });
});

describe('reconcilePlanForItems', () => {
  it('applies one survivor decision from the selected plan to plans with different packing', () => {
    // 选中方案：4 件中 0、1 已装，2、3 未装；减到 2 件 → 幸存身份为已装的 0、1
    const selected = plan({
      placements: [placement('coat', 0), placement('coat', 1, 3)],
      unplaced: [unplaced(item('coat', 4), 2), unplaced(item('coat', 4), 3)],
    });
    const survivors = selectSurvivorIndexes(selected, 'coat', 4, 2);
    expect([...survivors]).toEqual([0, 1]);

    // 另一方案原本装入了 2、3（选中方案里未装的副本）：统一裁决后这两件也必须撤掉，
    // 不能各方案自行保留不同身份
    const other = plan({ placements: [placement('coat', 2), placement('coat', 3, 3)] });
    const reconciled = reconcilePlanForQuantity(other, [item('coat', 2)], 'coat', 4, 2, survivors);
    expect(reconciled.placements).toEqual([]);
    expect(reconciled.itemSummaries[0]).toEqual({ itemId: 'coat', quantity: 2, packedCount: 0, unpackedCount: 2 });
  });

  it('drops placements and unplaced entries of removed kinds and rebuilds summaries', () => {
    const before = plan({
      placements: [placement('coat', 0), placement('gone', 0, 3)],
      unplaced: [unplaced(item('gone', 1), 0)],
    });
    const next = reconcilePlanForItems(before, [item('coat', 1)], { length: 10, width: 8, height: 6 });
    expect(next.placements.map((p) => p.itemId)).toEqual(['coat']);
    expect(next.unplaced).toEqual([]);
    expect(next.itemSummaries.map((summary) => summary.itemId)).toEqual(['coat']);
  });
});

describe('buildItemSummaries', () => {
  it('reports planned, packed and unpacked counts per kind', () => {
    const summaries = buildItemSummaries({ placements: [placement('a', 0)], unplaced: [] }, [item('a', 3), item('b', 2)]);
    expect(summaries).toEqual([
      { itemId: 'a', quantity: 3, packedCount: 1, unpackedCount: 2 },
      { itemId: 'b', quantity: 2, packedCount: 0, unpackedCount: 2 },
    ]);
  });
});
