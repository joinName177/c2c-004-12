import { describe, expect, it } from 'vitest';
import { createSampleSnapshot } from '../../core/sample-data';
import { usePlanner } from '../usePlanner';
import { initialCopies } from '../../core/item-copies';
import type { PackingItem, PackingSnapshot, Suitcase } from '../../core/models';
import type { PlannerRepository } from '../../ports/planner-repository.port';

class MemoryRepository implements PlannerRepository {
  saved?: PackingSnapshot;
  constructor(private snapshot = createSampleSnapshot()) {}
  load() { return { value: structuredClone(this.snapshot) }; }
  save(snapshot: PackingSnapshot) { this.saved = structuredClone(snapshot); }
}

const makeItem = (id: string, quantity: number): PackingItem => ({
  id, name: id, category: '衣物', length: 3, width: 2, height: 1, weight: 0.2, priority: 2, mustHave: false, quantity, copies: initialCopies(id, quantity),
});

describe('usePlanner', () => {
  it('adds, updates and removes items while marking results stale', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const initial = planner.state.items.length;
    planner.addItem(makeItem('new', 1));
    expect(planner.state.items).toHaveLength(initial + 1);
    expect(planner.isStale.value).toBe(true);
    planner.updateItem('new', { name: '遮阳帽' });
    expect(planner.state.items.find((item) => item.id === 'new')?.name).toBe('遮阳帽');
    planner.removeItem('new');
    expect(planner.state.items).toHaveLength(initial);
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

  it('recomputes all three plans immediately when quantity changes', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const before = planner.plans.value.comfort.placements.length;
    expect(planner.setQuantity('jacket', 3)).toBe(true);
    const jacket = planner.state.items.find((item) => item.id === 'jacket')!;
    expect(jacket.quantity).toBe(3);
    expect(jacket.copies).toEqual(['jacket#1', 'jacket#2', 'jacket#3']);
    expect(planner.isStale.value).toBe(false);
    expect(planner.plans.value.comfort.placements.length).toBeGreaterThan(before);
  });

  it('rejects zero, negative and decimal quantities without saving', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const savedCount = repository.saved ? 1 : 0;
    for (const bad of [0, -1, 2.5]) {
      expect(planner.setQuantity('jacket', bad)).toBe(false);
    }
    expect(planner.state.items.find((item) => item.id === 'jacket')?.quantity).toBe(1);
    expect(planner.quantityWarning.value).not.toBe('');
    expect(repository.saved ? 1 : 0).toBe(savedCount);
  });

  it('reduces quantity against the selected plan and preserves surviving copy identity', () => {
    const suitcase: Suitcase = { length: 100, width: 100, height: 100, maxWeight: 100 };
    const repository = new MemoryRepository({ suitcase, selectedPlan: 'comfort', items: [makeItem('sock', 5)] });
    const planner = usePlanner({ repository, printPort: { print() {} } });

    // 大箱子 + 轻物品：5 件全部装入；切到购物版同样全部装入
    expect(planner.plans.value.comfort.placements.map((p) => p.copyId)).toEqual(['sock#1', 'sock#2', 'sock#3', 'sock#4', 'sock#5']);
    planner.selectPlan('shopping');
    expect(planner.plans.value.shopping.placements.map((p) => p.copyId)).toEqual(['sock#1', 'sock#2', 'sock#3', 'sock#4', 'sock#5']);

    // 全部已装入时按固定顺序撤序号最大的，保留副本身份不变
    planner.setQuantity('sock', 2);
    const copies = planner.state.items.find((item) => item.id === 'sock')!.copies;
    expect(copies).toEqual(['sock#1', 'sock#2']);
    expect(planner.plans.value.shopping.placements.map((p) => p.copyId)).toEqual(['sock#1', 'sock#2']);

    // 重新加回数量时老副本身份不变、勾选位置不随机改变
    planner.setQuantity('sock', 3);
    expect(planner.state.items.find((item) => item.id === 'sock')!.copies).toEqual(['sock#1', 'sock#2', 'sock#3']);
  });

  it('removes unplaced copies first when the selected plan cannot load everything', () => {
    // 每件 1kg、承重 1kg（舒适版预留系数 1）：只有第一件能装入
    const suitcase: Suitcase = { length: 100, width: 100, height: 100, maxWeight: 1 };
    const heavy: PackingItem = { ...makeItem('sock', 4), weight: 1 };
    const repository = new MemoryRepository({ suitcase, selectedPlan: 'comfort', items: [heavy] });
    const planner = usePlanner({ repository, printPort: { print() {} } });
    expect(planner.plans.value.comfort.placements.map((p) => p.copyId)).toEqual(['sock#1']);

    planner.setQuantity('sock', 2);
    // #2、#3、#4 未装入，先撤序号最大的未装副本，#1 身份保留
    expect(planner.state.items.find((item) => item.id === 'sock')!.copies).toEqual(['sock#1', 'sock#2']);
    expect(planner.plans.value.comfort.placements.map((p) => p.copyId)).toEqual(['sock#1']);
  });
});
