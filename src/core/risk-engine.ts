import { rotationsOf } from './geometry';
import { instanceId } from './models';
import type { PackingItem, PackingPlan, Risk, Suitcase } from './models';

export function detectRisks(plan: PackingPlan, suitcase: Suitcase, items: PackingItem[]): Risk[] {
  const risks: Risk[] = [];
  const byId = new Map(items.map((item) => [item.id, item]));

  if (plan.totalWeight > suitcase.maxWeight) risks.push({ id: 'overweight', severity: 'critical', title: '行李超重', message: `超出承重 ${(plan.totalWeight - suitcase.maxWeight).toFixed(1)} kg，请移除重物。` });
  else if (plan.totalWeight / suitcase.maxWeight > 0.9) risks.push({ id: 'near-weight', severity: 'warning', title: '接近承重上限', message: '建议预留至少 10% 承重余量。' });
  if (plan.capacityRatio > 0.9) risks.push({ id: 'high-volume', severity: 'warning', title: '空间接近满载', message: '空间利用率超过 90%，返程新增物品可能无法装入。' });

  // 按种类汇总：必带物品全部数量装入才算齐全，部分装入明确提示缺几件
  for (const summary of plan.itemSummaries) {
    const item = byId.get(summary.itemId);
    if (!item) continue;
    if (item.mustHave && summary.unpackedCount > 0) {
      const packed = summary.packedCount;
      const total = summary.quantity;
      risks.push({
        id: `missing-${item.id}`,
        severity: 'critical',
        title: `必需品未齐全：${item.name}`,
        message: packed === 0
          ? `共计划携带 ${total} 件，已装入 0 件，尚缺 ${total} 件。请调整清单或改用更大行李箱。`
          : `共计划携带 ${total} 件，已装入 ${packed} 件，尚缺 ${summary.unpackedCount} 件。请调整清单或改用更大行李箱。`,
        itemId: item.id,
      });
    }
  }

  // 尺寸越界：任一副本无法放入即按种类提示一次
  for (const { item } of plan.unplaced) {
    if (!item) continue;
    const oversized = rotationsOf(item).every((d) => d.length > suitcase.length || d.width > suitcase.width || d.height > suitcase.height);
    if (oversized && !risks.some((risk) => risk.id === `oversized-${item.id}`)) {
      risks.push({ id: `oversized-${item.id}`, severity: 'critical', title: `${item.name} 尺寸越界`, message: '任意旋转方向都无法放入当前行李箱。', itemId: item.id });
    }
  }

  for (const placement of plan.placements) {
    const item = byId.get(placement.itemId);
    if (!item) continue;
    const suffix = item.quantity > 1 ? `（第${placement.instanceIndex + 1}件）` : '';
    const placementId = instanceId(item.id, placement.instanceIndex);
    if (item.weight >= suitcase.maxWeight * 0.25 && placement.z > suitcase.height * 0.5) {
      risks.push({ id: `high-${placementId}`, severity: 'warning', title: `${item.name}${suffix} 重心偏高`, message: '将重物移到箱体底部，降低翻倒和挤压风险。', itemId: item.id, instanceIndex: placement.instanceIndex });
    }
    if (item.fragile) {
      const hasLoadAbove = plan.placements.some((other) => instanceId(other.itemId, other.instanceIndex) !== placementId
        && other.z >= placement.z + placement.dimensions.height
        && other.x < placement.x + placement.dimensions.length && other.x + other.dimensions.length > placement.x
        && other.y < placement.y + placement.dimensions.width && other.y + other.dimensions.width > placement.y);
      if (hasLoadAbove) risks.push({ id: `fragile-${placementId}`, severity: 'warning', title: `${item.name}${suffix} 受到上方挤压`, message: '请移到上层或增加缓冲保护。', itemId: item.id, instanceIndex: placement.instanceIndex });
    }
  }

  if (!risks.length) risks.push({ id: 'all-clear', severity: 'info', title: '装载状态良好', message: '重量、空间和摆放风险均在合理范围内。' });
  return risks;
}
