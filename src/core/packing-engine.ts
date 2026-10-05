import { intersects, rotationsOf } from './geometry';
import { buildItemSummaries } from './plan-reconcile';
import { itemVolume, suitcaseVolume, type PackingItem, type PackingPlan, type Placement, type PlanMode, type Suitcase, type UnplacedEntry } from './models';

const PLAN_NAMES: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };
const RESERVE: Record<PlanMode, number> = { minimal: 0.8, comfort: 1, shopping: 0.65 };

export function validateSuitcase(suitcase: Suitcase): string[] {
  const errors: string[] = [];
  if (!(suitcase.length > 0)) errors.push('行李箱长度必须大于 0');
  if (!(suitcase.width > 0)) errors.push('行李箱宽度必须大于 0');
  if (!(suitcase.height > 0)) errors.push('行李箱高度必须大于 0');
  if (!(suitcase.maxWeight > 0)) errors.push('承重必须大于 0');
  return errors;
}

/** 尺寸、重量必须为正数，数量必须为大于 0 的整数 */
export function validateItem(item: Pick<PackingItem, 'length' | 'width' | 'height' | 'weight' | 'quantity'>): string[] {
  const errors: string[] = [];
  if (!(item.length > 0)) errors.push('物品长度必须大于 0');
  if (!(item.width > 0)) errors.push('物品宽度必须大于 0');
  if (!(item.height > 0)) errors.push('物品高度必须大于 0');
  if (!(item.weight > 0)) errors.push('物品重量必须大于 0');
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) errors.push('数量必须是大于 0 的整数');
  return errors;
}

function ordered(items: PackingItem[], mode: PlanMode): PackingItem[] {
  return [...items].sort((a, b) => {
    const required = Number(b.mustHave) - Number(a.mustHave);
    if (required) return required;
    const priority = b.priority - a.priority;
    if (priority) return priority;
    return mode === 'shopping' ? a.weight - b.weight : itemVolume(b) - itemVolume(a) || a.id.localeCompare(b.id);
  });
}

function candidatePoints(placements: Placement[]) {
  const points = [{ x: 0, y: 0, z: 0 }];
  for (const p of placements) {
    points.push(
      { x: p.x + p.dimensions.length, y: p.y, z: p.z },
      { x: p.x, y: p.y + p.dimensions.width, z: p.z },
      { x: p.x, y: p.y, z: p.z + p.dimensions.height },
    );
  }
  return points.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
}

function tryPlace(item: PackingItem, instanceIndex: number, placements: Placement[], suitcase: Suitcase): Placement | undefined {
  for (const point of candidatePoints(placements)) {
    for (const dimensions of rotationsOf(item)) {
      const candidate: Placement = { itemId: item.id, instanceIndex, ...point, dimensions };
      const inBounds = candidate.x + dimensions.length <= suitcase.length
        && candidate.y + dimensions.width <= suitcase.width
        && candidate.z + dimensions.height <= suitcase.height;
      if (inBounds && placements.every((placed) => !intersects(candidate, placed))) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): PackingPlan {
  const placements: Placement[] = [];
  const unplaced: UnplacedEntry[] = [];
  const capacity = suitcaseVolume(suitcase) * RESERVE[mode];
  const maxWeight = suitcase.maxWeight * RESERVE[mode];
  let totalWeight = 0;
  let usedVolume = 0;

  for (const item of ordered(items, mode)) {
    const invalid = validateItem(item);
    // 每一件副本都独立占空间和重量，逐件尝试放入
    for (let instanceIndex = 0; instanceIndex < item.quantity; instanceIndex += 1) {
      if (invalid.length) {
        unplaced.push({ item, instanceIndex, reason: '尺寸、重量或数量无效' });
        continue;
      }
      if (totalWeight + item.weight > maxWeight) {
        unplaced.push({ item, instanceIndex, reason: '超过当前方案承重预留' });
        continue;
      }
      if (usedVolume + itemVolume(item) > capacity) {
        unplaced.push({ item, instanceIndex, reason: '超过当前方案空间预留' });
        continue;
      }

      const placement = tryPlace(item, instanceIndex, placements, suitcase);
      if (!placement) {
        unplaced.push({ item, instanceIndex, reason: '没有可用的连续空间' });
        continue;
      }
      placements.push(placement);
      totalWeight += item.weight;
      usedVolume += itemVolume(item);
    }
  }

  const plan: PackingPlan = {
    id: mode,
    name: PLAN_NAMES[mode],
    placements,
    unplaced,
    itemSummaries: [],
    totalWeight,
    usedVolume,
    capacityRatio: suitcaseVolume(suitcase) ? usedVolume / suitcaseVolume(suitcase) : 0,
  };
  plan.itemSummaries = buildItemSummaries(plan, items);
  return plan;
}
