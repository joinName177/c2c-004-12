export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface Suitcase extends Dimensions {
  maxWeight: number;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  /** 计划携带的件数，必须为大于 0 的整数；每件副本独立占空间和重量 */
  quantity: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
}

export interface Placement {
  itemId: string;
  /** 同一物品的第几件（0 起），数量变化时靠它保留副本身份 */
  instanceIndex: number;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface UnplacedEntry {
  item: PackingItem;
  /** 未装入的是第几件（0 起） */
  instanceIndex: number;
  reason: string;
}

export interface ItemPackingSummary {
  itemId: string;
  /** 计划携带件数 */
  quantity: number;
  /** 当前方案已装入件数 */
  packedCount: number;
  /** 当前方案尚未装入件数 */
  unpackedCount: number;
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: UnplacedEntry[];
  /** 按物品种类汇总的计划、已装和未装数量 */
  itemSummaries: ItemPackingSummary[];
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
  instanceIndex?: number;
}

export interface PackingSnapshot {
  suitcase: Suitcase;
  items: PackingItem[];
  selectedPlan: PlanMode;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}

/** 某个具体副本的稳定身份标识，用于摆放图定位和去重 */
export function instanceId(itemId: string, instanceIndex: number): string {
  return `${itemId}#${instanceIndex}`;
}

/** 副本的可读名称，多件时标注“第 N 件” */
export function instanceLabel(name: string, instanceIndex: number, quantity: number): string {
  return quantity > 1 ? `${name} 第${instanceIndex + 1}件` : name;
}

/** 清单中所有物品计划携带的总件数 */
export function totalInstanceCount(items: ReadonlyArray<Pick<PackingItem, 'quantity'>>): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** 清单全部副本（含未装入）的计划总重量 */
export function totalPlannedWeight(items: ReadonlyArray<Pick<PackingItem, 'weight' | 'quantity'>>): number {
  return items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
}
