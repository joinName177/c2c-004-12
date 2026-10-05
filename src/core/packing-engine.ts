import { intersects, rotationsOf } from './geometry';
import { copySequence } from './item-copies';
import { itemVolume, suitcaseVolume, type PackingItem, type PackingPlan, type Placement, type PlanMode, type Suitcase } from './models';

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

/** 同种类的副本必须连续装箱，种类之间沿用原有优先级排序，ID 兜底保证结果确定。 */
function ordered(items: PackingItem[], mode: PlanMode): PackingItem[] {
  return [...items].sort((a, b) => {
    const required = Number(b.mustHave) - Number(a.mustHave);
    if (required) return required;
    const priority = b.priority - a.priority;
    if (priority) return priority;
    if (mode === 'shopping') return a.weight - b.weight || a.id.localeCompare(b.id);
    return itemVolume(b) - itemVolume(a) || a.id.localeCompare(b.id);
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

export function packItems(suitcase: Suitcase, items: PackingItem[], mode: PlanMode): PackingPlan {
  const placements: Placement[] = [];
  const unplaced: PackingPlan['unplaced'] = [];
  const capacity = suitcaseVolume(suitcase) * RESERVE[mode];
  const maxWeight = suitcase.maxWeight * RESERVE[mode];
  let totalWeight = 0;
  let usedVolume = 0;

  const pushUnplaced = (item: PackingItem, copyId: string, reason: string) => unplaced.push({ item, copyId, reason });

  for (const item of ordered(items, mode)) {
    const copies = [...item.copies].sort((a, b) => copySequence(a) - copySequence(b) || a.localeCompare(b));

    if ([item.length, item.width, item.height, item.weight].some((value) => !(value > 0))) {
      copies.forEach((copyId) => pushUnplaced(item, copyId, '尺寸或重量无效'));
      continue;
    }

    for (const copyId of copies) {
      if (totalWeight + item.weight > maxWeight) {
        pushUnplaced(item, copyId, '超过当前方案承重预留');
        continue;
      }
      if (usedVolume + itemVolume(item) > capacity) {
        pushUnplaced(item, copyId, '超过当前方案空间预留');
        continue;
      }

      let placement: Placement | undefined;
      for (const point of candidatePoints(placements)) {
        for (const dimensions of rotationsOf(item)) {
          const candidate: Placement = { itemId: item.id, copyId, ...point, dimensions };
          const inBounds = candidate.x + dimensions.length <= suitcase.length
            && candidate.y + dimensions.width <= suitcase.width
            && candidate.z + dimensions.height <= suitcase.height;
          if (inBounds && placements.every((placed) => !intersects(candidate, placed))) {
            placement = candidate;
            break;
          }
        }
        if (placement) break;
      }

      if (!placement) {
        pushUnplaced(item, copyId, '没有可用的连续空间');
        continue;
      }
      placements.push(placement);
      // 每一件副本都独立占用重量和空间
      totalWeight += item.weight;
      usedVolume += itemVolume(item);
    }
  }

  return {
    id: mode,
    name: PLAN_NAMES[mode],
    placements,
    unplaced,
    totalWeight,
    usedVolume,
    capacityRatio: suitcaseVolume(suitcase) ? usedVolume / suitcaseVolume(suitcase) : 0,
  };
}
