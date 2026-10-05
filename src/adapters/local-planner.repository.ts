import { createSampleSnapshot } from '../core/sample-data';
import { normalizeSnapshotItems } from '../core/item-copies';
import type { PackingSnapshot } from '../core/models';
import type { LoadResult, PlannerRepository } from '../ports/planner-repository.port';

const KEY = 'c2c-004.planner';

export class LocalPlannerRepository implements PlannerRepository {
  constructor(private readonly storage: Storage) {}

  load(): LoadResult<PackingSnapshot> {
    const raw = this.storage.getItem(KEY);
    if (!raw) return { value: createSampleSnapshot() };
    try {
      const snapshot = JSON.parse(raw) as PackingSnapshot;
      // 旧记录没有数量信息，默认每种一件并补齐副本身份
      return { value: { ...snapshot, items: normalizeSnapshotItems(snapshot.items ?? []) } };
    } catch {
      return { value: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
    }
  }

  save(snapshot: PackingSnapshot): void {
    this.storage.setItem(KEY, JSON.stringify(snapshot));
  }
}
