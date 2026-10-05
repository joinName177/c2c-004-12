import type { PackingItem } from './models';

export function copyId(itemId: string, sequence: number): string {
  return `${itemId}#${sequence}`;
}

/** 从副本 ID 解析其固定序号，无法解析时退化为字典序，保证排序确定。 */
export function copySequence(copyIdValue: string): number {
  const tail = copyIdValue.slice(copyIdValue.lastIndexOf('#') + 1);
  const sequence = Number(tail);
  return Number.isInteger(sequence) && sequence > 0 ? sequence : Number.POSITIVE_INFINITY;
}

/** 合法数量必须是正整数；零、负数、小数均拒绝保存。 */
export function isValidQuantity(value: number): value is number {
  return Number.isInteger(value) && value > 0;
}

export function quantityError(value: number): string {
  if (!Number.isFinite(value)) return '数量必须是正整数';
  if (value <= 0) return '数量必须大于 0';
  if (!Number.isInteger(value)) return '数量不支持小数';
  return '';
}

/** 新建物品时的初始副本身份。 */
export function initialCopies(itemId: string, quantity: number): string[] {
  return Array.from({ length: quantity }, (_, index) => copyId(itemId, index + 1));
}

/** 兼容旧记录：缺少数量默认一件，并补齐稳定的副本身份。 */
export function normalizeItem(raw: PackingItem): PackingItem {
  const quantity = isValidQuantity(raw.quantity) ? raw.quantity : 1;
  if (Array.isArray(raw.copies) && raw.copies.length === quantity && raw.copies.every((value) => typeof value === 'string')) {
    return { ...raw, quantity, copies: [...raw.copies] };
  }
  return { ...raw, quantity, copies: initialCopies(raw.id, quantity) };
}

export function normalizeSnapshotItems(items: PackingItem[]): PackingItem[] {
  return items.map(normalizeItem);
}

/**
 * 数量变化时调整副本身份。
 *
 * 规则：以当前选中方案为准，优先撤掉尚未装入的副本，再撤掉已装入的副本；
 * 两个阶段都按固定序号从大到小撤。保留下来的副本身份不变，数量增加时新副本
 * 追加到序号末尾。绝不随机改变已有副本的勾选位置。
 *
 * @param currentCopies 当前副本身份（长度等于旧数量）
 * @param nextQuantity  新的正整数数量
 * @param placedCopyIds 当前选中方案中已装入的副本 ID 集合
 */
export function resizeCopies(currentCopies: string[], nextQuantity: number, placedCopyIds: ReadonlySet<string>): string[] {
  if (!isValidQuantity(nextQuantity)) return [...currentCopies];

  if (nextQuantity >= currentCopies.length) {
    const next = [...currentCopies];
    // 可能存在此前撤副本留下的序号空洞，新副本按“现存最大序号 + 1”追加，避免身份碰撞
    let sequence = currentCopies.reduce((max, id) => Math.max(max, copySequence(id)), 0);
    const baseId = currentCopies[0]?.slice(0, currentCopies[0].lastIndexOf('#')) ?? 'item';
    while (next.length < nextQuantity) {
      sequence += 1;
      next.push(copyId(baseId, sequence));
    }
    return next;
  }

  const survivors = new Set(currentCopies);
  const remove = (candidates: string[]) => {
    candidates
      .sort((a, b) => copySequence(b) - copySequence(a) || a.localeCompare(b))
      .forEach((id) => {
        if (survivors.size > nextQuantity) survivors.delete(id);
      });
  };
  // 先撤尚未装入的副本
  remove(currentCopies.filter((id) => !placedCopyIds.has(id)));
  // 仍需缩减时，再按固定顺序撤掉已装入的副本
  if (survivors.size > nextQuantity) remove([...survivors].filter((id) => placedCopyIds.has(id)));

  // 输出保持原有的固定先后顺序，身份不重排、不重编号
  return currentCopies.filter((id) => survivors.has(id));
}
