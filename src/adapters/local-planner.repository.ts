import { createSampleSnapshot } from '../core/sample-data';
import { migrateSnapshot } from '../core/snapshot-migration';
import type { PackingSnapshot } from '../core/models';
import type { LoadResult, PlannerRepository } from '../ports/planner-repository.port';

const KEY = 'c2c-004.planner';

export class LocalPlannerRepository implements PlannerRepository {
  constructor(private readonly storage: Storage) {}

  load(): LoadResult<PackingSnapshot> {
    const raw = this.storage.getItem(KEY);
    if (!raw) return { value: createSampleSnapshot() };
    try {
      const result = migrateSnapshot(JSON.parse(raw));
      return { value: result.snapshot, warning: result.warning };
    } catch {
      return { value: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
    }
  }

  save(snapshot: PackingSnapshot): void {
    // 零、负数、小数数量不允许保存：落盘前再规范化一次
    const { snapshot: normalized } = migrateSnapshot(snapshot);
    this.storage.setItem(KEY, JSON.stringify(normalized));
  }
}
