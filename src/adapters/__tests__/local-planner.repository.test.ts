import { beforeEach, describe, expect, it } from 'vitest';
import { LocalPlannerRepository } from '../local-planner.repository';
import { createSampleSnapshot } from '../../core/sample-data';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('LocalPlannerRepository', () => {
  const storage = new MemoryStorage();
  beforeEach(() => storage.clear());

  it('round trips a planning snapshot', () => {
    const repo = new LocalPlannerRepository(storage);
    const sample = createSampleSnapshot();
    const snapshot = { ...sample, suitcase: { ...sample.suitcase, length: 61 } };
    repo.save(snapshot);
    expect(repo.load().value.suitcase.length).toBe(61);
  });

  it('returns sample data when storage is empty', () => {
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.warning).toBeUndefined();
  });

  it('returns sample data and a warning for malformed JSON', () => {
    storage.setItem('c2c-004.planner', '{bad');
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.length).toBeGreaterThan(0);
    expect(result.warning).toContain('已恢复示例');
  });

  it('migrates legacy items without quantity by defaulting them to one', () => {
    const sample = createSampleSnapshot();
    const legacy = {
      ...sample,
      items: sample.items.map(({ quantity: _quantity, ...rest }) => rest),
    };
    storage.setItem('c2c-004.planner', JSON.stringify(legacy));
    const result = new LocalPlannerRepository(storage).load();
    expect(result.value.items.every((item) => item.quantity === 1)).toBe(true);
    expect(result.warning).toContain('默认');
  });

  it('never persists zero or negative quantities, normalizing them to one', () => {
    const repo = new LocalPlannerRepository(storage);
    const sample = createSampleSnapshot();
    repo.save({ ...sample, items: [{ ...sample.items[0]!, quantity: 0 }, { ...sample.items[1]!, quantity: -4 }] });
    const loaded = JSON.parse(storage.getItem('c2c-004.planner')!);
    expect(loaded.items.map((item: { quantity: number }) => item.quantity)).toEqual([1, 1]);
  });
});
