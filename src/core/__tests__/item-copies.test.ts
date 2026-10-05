import { describe, expect, it } from 'vitest';
import { copyId, copySequence, initialCopies, isValidQuantity, normalizeItem, quantityError, resizeCopies } from '../item-copies';
import { initialCopies as makeCopies } from '../item-copies';
import type { PackingItem } from '../models';

const kind = (id: string, quantity: number, copies = makeCopies(id, quantity)): PackingItem => ({
  id, name: id, category: '衣物', length: 10, width: 5, height: 2, weight: 1, priority: 2, mustHave: false, quantity, copies,
});

describe('copy identity', () => {
  it('builds and parses fixed sequence ids', () => {
    expect(copyId('sock', 3)).toBe('sock#3');
    expect(copySequence('sock#3')).toBe(3);
  });

  it('only accepts positive integers as quantity', () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-2)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(quantityError(0)).toContain('大于 0');
    expect(quantityError(1.5)).toContain('小数');
  });

  it('defaults legacy records to one copy and repairs mismatched identities', () => {
    const legacy = { ...kind('old', 0, []), quantity: undefined as unknown as number };
    expect(normalizeItem(legacy).quantity).toBe(1);
    expect(normalizeItem(legacy).copies).toEqual(['old#1']);
    const broken = { ...kind('a', 2), copies: ['x'] };
    expect(normalizeItem(broken).copies).toEqual(['a#1', 'a#2']);
  });

  it('appends new copies beyond the largest existing sequence when increasing', () => {
    // 此前缩减留下序号空洞：#1、#3 仍在
    const next = resizeCopies(['sock#1', 'sock#3'], 3, new Set(['sock#1', 'sock#3']));
    expect(next).toEqual(['sock#1', 'sock#3', 'sock#4']);
  });

  it('removes unplaced copies before placed ones when decreasing', () => {
    const copies = initialCopies('sock', 4);
    const placed = new Set(['sock#1', 'sock#2']); // #3、#4 未装入
    expect(resizeCopies(copies, 2, placed)).toEqual(['sock#1', 'sock#2']);
  });

  it('falls back to removing placed copies in fixed descending sequence order', () => {
    const copies = initialCopies('sock', 4);
    const placed = new Set(copies);
    expect(resizeCopies(copies, 2, placed)).toEqual(['sock#1', 'sock#2']);
  });

  it('mixes the two phases deterministically and preserves survivor identity', () => {
    const copies = initialCopies('sock', 5);
    // 已装入 #1 #2 #3，未装入 #4 #5；缩到 2 件：先撤 #5、#4，仍多一件再撤已装入中序号最大的 #3
    const placed = new Set(['sock#1', 'sock#2', 'sock#3']);
    const next = resizeCopies(copies, 2, placed);
    expect(next).toEqual(['sock#1', 'sock#2']);
    // 再增回 4 件，老副本身份保持，新副本追加到最大序号之后
    expect(resizeCopies(next, 4, new Set(next))).toEqual(['sock#1', 'sock#2', 'sock#3', 'sock#4']);
  });
});
