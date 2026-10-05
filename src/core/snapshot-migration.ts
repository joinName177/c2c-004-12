import { createSampleSnapshot } from './sample-data';
import type { PackingItem, PackingSnapshot } from './models';

export interface MigrationResult {
  snapshot: PackingSnapshot;
  /** 迁移过程中修正了哪些数据，用于非阻塞提示 */
  warning?: string;
}

/**
 * 规范化历史快照：
 * - 缺少 quantity 的旧记录默认按 1 件处理；
 * - 零、负数、小数或其他非法数量一律纠正为 1，不允许保存非法值；
 * - 结构损坏无法识别时回退示例数据。
 */
export function migrateSnapshot(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object') return { snapshot: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
  const candidate = raw as Partial<PackingSnapshot>;
  if (!candidate.suitcase || !Array.isArray(candidate.items)) {
    return { snapshot: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
  }

  let defaulted = 0;
  let corrected = 0;
  const items: PackingItem[] = candidate.items.map((entry) => {
    const item = entry as PackingItem;
    if (item.quantity === undefined || item.quantity === null) {
      defaulted += 1;
      return { ...item, quantity: 1 };
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      corrected += 1;
      return { ...item, quantity: 1 };
    }
    return item;
  });

  const snapshot: PackingSnapshot = {
    suitcase: candidate.suitcase,
    items,
    selectedPlan: candidate.selectedPlan ?? 'comfort',
  };

  const notes: string[] = [];
  if (defaulted) notes.push(`${defaulted} 条旧记录已按默认 1 件补全数量`);
  if (corrected) notes.push(`${corrected} 条非法数量已纠正为 1`);
  return { snapshot, warning: notes.length ? `已迁移旧版清单：${notes.join('，')}。` : undefined };
}
