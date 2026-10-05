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
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
  /** 计划携带的数量（正整数），清单纯粹按种类编辑 */
  quantity: number;
  /** 每个副本的稳定身份 ID，长度恒等于 quantity，如 item-id#1、item-id#2 */
  copies: string[];
}

export interface Placement {
  itemId: string;
  /** 被定位到的具体副本 */
  copyId: string;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface UnplacedEntry {
  item: PackingItem;
  copyId: string;
  reason: string;
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: UnplacedEntry[];
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
