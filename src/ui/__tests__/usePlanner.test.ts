import { describe, expect, it } from 'vitest';
import { createSampleSnapshot } from '../../core/sample-data';
import { usePlanner } from '../usePlanner';
import type { PackingItem, PackingSnapshot } from '../../core/models';
import type { PlannerRepository } from '../../ports/planner-repository.port';

class MemoryRepository implements PlannerRepository {
  saved?: PackingSnapshot;
  constructor(private snapshot = createSampleSnapshot()) {}
  load() { return { value: structuredClone(this.snapshot) }; }
  save(snapshot: PackingSnapshot) { this.saved = structuredClone(snapshot); }
}

const newItem: PackingItem = { id: 'new', name: '帽子', category: '衣物', length: 12, width: 12, height: 5, weight: 0.2, quantity: 1, priority: 2, mustHave: false };

describe('usePlanner', () => {
  it('adds, updates and removes items while marking results stale', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const initial = planner.state.items.length;
    planner.addItem({ ...newItem });
    expect(planner.state.items).toHaveLength(initial + 1);
    expect(planner.isStale.value).toBe(true);
    planner.updateItem('new', { name: '遮阳帽' });
    expect(planner.state.items.find((item) => item.id === 'new')?.name).toBe('遮阳帽');
    planner.removeItem('new');
    expect(planner.state.items).toHaveLength(initial);
  });

  it('rejects adding items with invalid quantity', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    const before = planner.state.items.length;
    const result = planner.addItem({ ...newItem, quantity: 0 });
    expect(result.ok).toBe(false);
    expect(planner.state.items).toHaveLength(before);
  });

  it('recomputes the three plans after a quantity change and keeps totals consistent with copies', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    const id = planner.state.items[0]!.id;
    const result = planner.setItemQuantity(id, 4);
    expect(result.ok).toBe(true);
    expect(planner.state.items.find((item) => item.id === id)?.quantity).toBe(4);
    for (const plan of Object.values(planner.plans.value)) {
      const summary = plan.itemSummaries.find((entry) => entry.itemId === id)!;
      expect(summary.quantity).toBe(4);
      expect(summary.packedCount + summary.unpackedCount).toBe(4);
    }
  });

  it('refuses zero, negative and decimal quantities without mutating state', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    const id = planner.state.items[0]!.id;
    for (const quantity of [0, -1, 1.5]) {
      const result = planner.setItemQuantity(id, quantity);
      expect(result.ok).toBe(false);
    }
    expect(planner.state.items.find((item) => item.id === id)?.quantity).toBeGreaterThan(0);
  });

  it('preserves packed copy identities when shrinking quantity: unpacked copies first, then high indexes', () => {
    // 构造：3 件外套全部装入当前舒适版方案
    const snapshot = createSampleSnapshot();
    snapshot.items = [{
      id: 'coat', name: '外套', category: '衣物', length: 10, width: 5, height: 2, weight: 0.5, quantity: 3, priority: 2, mustHave: false,
    }];
    const planner = usePlanner({ repository: new MemoryRepository(snapshot), printPort: { print() {} } });
    expect(planner.currentPlan.value.placements.map((p) => p.instanceIndex)).toEqual([0, 1, 2]);
    planner.setItemQuantity('coat', 1);
    // 固定顺序撤掉大号已装入副本，保留第 1 件（序号 0）的身份
    expect(planner.currentPlan.value.placements.map((p) => p.instanceIndex)).toEqual([0]);
    expect(planner.currentPlan.value.totalWeight).toBe(0.5);
  });

  it('regenerates plans and persists the selected mode', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    planner.updateSuitcase({ maxWeight: 12 });
    expect(planner.isStale.value).toBe(true);
    planner.regenerate();
    planner.selectPlan('shopping');
    expect(planner.isStale.value).toBe(false);
    expect(planner.plans.value.shopping.name).toBe('购物版');
    expect(repository.saved?.selectedPlan).toBe('shopping');
  });
});
