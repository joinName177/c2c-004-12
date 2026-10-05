import { itemVolume, suitcaseVolume, type ItemPackingSummary, type PackingItem, type PackingPlan, type Placement, type PlanMode, type UnplacedEntry } from './models';

/**
 * 数量减少时保留哪些副本身份：
 * 先撤掉当前方案里尚未装入的副本（序号从大到小撤），
 * 再按固定顺序（已装入副本序号从大到小）撤掉已装入的副本。
 * 返回保留下来的已装入与未装入身份集合，不随机、不改号，避免勾选位置跳动。
 */
export function retainInstanceIndexes(
  previousQuantity: number,
  nextQuantity: number,
  packedIndexes: ReadonlySet<number>,
): { packed: number[]; unpacked: number[] } {
  if (nextQuantity >= previousQuantity) {
    return {
      packed: [...packedIndexes].sort((a, b) => a - b),
      unpacked: Array.from({ length: previousQuantity }, (_, index) => index).filter((index) => !packedIndexes.has(index)),
    };
  }
  let packed = new Set<number>();
  const unpacked: number[] = [];
  for (let index = 0; index < previousQuantity; index += 1) {
    if (packedIndexes.has(index)) packed.add(index);
    else unpacked.push(index);
  }
  // 撤掉顺序：未装入副本大号优先，然后已装入副本大号优先
  const removalOrder = [...unpacked.sort((a, b) => b - a), ...[...packed].sort((a, b) => b - a)];
  let toRemove = previousQuantity - nextQuantity;
  const removed = new Set<number>();
  for (const index of removalOrder) {
    if (toRemove <= 0) break;
    removed.add(index);
    toRemove -= 1;
  }
  packed = new Set([...packed].filter((index) => !removed.has(index)));
  return {
    packed: [...packed].sort((a, b) => a - b),
    unpacked: unpacked.filter((index) => !removed.has(index)).sort((a, b) => a - b),
  };
}

export function buildItemSummaries(plan: Pick<PackingPlan, 'placements' | 'unplaced'>, items: ReadonlyArray<Pick<PackingItem, 'id' | 'quantity'>>): ItemPackingSummary[] {
  const packed = new Map<string, number>();
  for (const placement of plan.placements) packed.set(placement.itemId, (packed.get(placement.itemId) ?? 0) + 1);
  return items.map((item) => {
    const packedCount = packed.get(item.id) ?? 0;
    return {
      itemId: item.id,
      quantity: item.quantity,
      packedCount,
      unpackedCount: Math.max(0, item.quantity - packedCount),
    };
  });
}

/** 依据现有摆放/未装记录重算总重量、总体积和按种类的数量汇总（副本清单不变时使用） */
export function rebuildPlanMeta(
  plan: PackingPlan,
  items: ReadonlyArray<PackingItem>,
  suitcase?: { length: number; width: number; height: number },
): PackingPlan {
  const byId = new Map(items.map((item) => [item.id, item]));
  let totalWeight = 0;
  let usedVolume = 0;
  for (const placement of plan.placements) {
    const item = byId.get(placement.itemId);
    if (!item) continue;
    totalWeight += item.weight;
    usedVolume += itemVolume(placement.dimensions);
  }
  return {
    ...plan,
    itemSummaries: buildItemSummaries(plan, items),
    totalWeight,
    usedVolume,
    capacityRatio: suitcase ? usedVolume / suitcaseVolume(suitcase) : plan.capacityRatio,
  };
}

/**
 * 对某一物品数量变化做身份保留的对账：
 * - 数量减少：撤掉未装入副本，再按固定顺序撤已装入副本，其余副本身份不变；
 * - 数量增加：保留全部旧副本，新副本标记为未装入（等待重新装箱）；
 * 对账后重算方案的总重量、总体积和各品类计划/已装/未装数量。
 *
 * survivorIndexes 为“数量减少后保留哪些副本身份”的统一裁决（由调用方以当前
 * 选中方案的已装集合算出后下发给三套方案）；不传时按本方案各自的已装集合裁决。
 */
export function reconcilePlanForQuantity(
  plan: PackingPlan,
  items: ReadonlyArray<PackingItem>,
  itemId: string,
  previousQuantity: number,
  nextQuantity: number,
  survivorIndexes?: ReadonlySet<number>,
): PackingPlan {
  const item = items.find((entry) => entry.id === itemId);
  if (!item || previousQuantity === nextQuantity) return rebuildPlanMeta(plan, items);

  let placements: Placement[];
  let unplaced: UnplacedEntry[];

  if (nextQuantity < previousQuantity) {
    let survivors: ReadonlySet<number>;
    if (survivorIndexes) {
      survivors = survivorIndexes;
    } else {
      const packedIndexes = new Set(
        plan.placements.filter((placement) => placement.itemId === itemId).map((placement) => placement.instanceIndex),
      );
      // 按“未装入优先、大号序号优先”的固定顺序裁剪
      const retained = retainInstanceIndexes(previousQuantity, nextQuantity, packedIndexes);
      survivors = new Set([...retained.packed, ...retained.unpacked]);
    }
    // 统一的幸存身份应用于每个方案：被撤掉的副本无论在本方案是否已装都移除
    placements = plan.placements.filter(
      (placement) => placement.itemId !== itemId || survivors.has(placement.instanceIndex),
    );
    unplaced = plan.unplaced
      .filter((entry) => entry.item.id !== itemId || survivors.has(entry.instanceIndex))
      .map((entry) => (entry.item.id === itemId && item ? { ...entry, item } : entry));
  } else {
    placements = [...plan.placements];
    unplaced = plan.unplaced.map((entry) => (entry.item.id === itemId ? { ...entry, item } : entry));
    const packedIndexes = new Set(
      placements.filter((placement) => placement.itemId === itemId).map((placement) => placement.instanceIndex),
    );
    const existingUnpacked = new Set(
      unplaced.filter((entry) => entry.item.id === itemId).map((entry) => entry.instanceIndex),
    );
    for (let index = 0; index < nextQuantity; index += 1) {
      if (!packedIndexes.has(index) && !existingUnpacked.has(index)) {
        unplaced.push({ item, instanceIndex: index, reason: '数量已增加，等待重新装箱' });
        existingUnpacked.add(index);
      }
    }
  }

  return rebuildPlanMeta({ ...plan, placements, unplaced }, items);
}

/** 以当前选中方案为基准，计算数量减少后保留下来的副本身份集合 */
export function selectSurvivorIndexes(
  selectedPlan: PackingPlan,
  itemId: string,
  previousQuantity: number,
  nextQuantity: number,
): Set<number> {
  if (nextQuantity >= previousQuantity) return new Set(Array.from({ length: previousQuantity }, (_, index) => index));
  const packedIndexes = new Set(
    selectedPlan.placements.filter((placement) => placement.itemId === itemId).map((placement) => placement.instanceIndex),
  );
  const retained = retainInstanceIndexes(previousQuantity, nextQuantity, packedIndexes);
  return new Set([...retained.packed, ...retained.unpacked]);
}

/** 物品清单结构性变化（删除）后，丢弃悬空副本并重算三套方案汇总 */
export function reconcilePlanForItems(plan: PackingPlan, items: ReadonlyArray<PackingItem>, suitcase: { length: number; width: number; height: number }): PackingPlan {
  const validIds = new Set(items.map((item) => item.id));
  const filtered: PackingPlan = {
    ...plan,
    placements: plan.placements.filter((placement) => validIds.has(placement.itemId)),
    unplaced: plan.unplaced.filter((entry) => validIds.has(entry.item.id)),
  };
  return rebuildPlanMeta(filtered, items, suitcase);
}

export function emptyPlan(mode: PlanMode, name: string): PackingPlan {
  return { id: mode, name, placements: [], unplaced: [], itemSummaries: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0 };
}
