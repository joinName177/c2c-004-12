import { describe, expect, it } from 'vitest';
import { detectRisks } from '../risk-engine';
import { initialCopies } from '../item-copies';
import type { PackingItem, PackingPlan, Suitcase } from '../models';

const suitcase: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, priority: 2, mustHave: false, quantity: 1, copies: initialCopies(id, 1), ...overrides });
const placement = (id: string, z = 0, copySequence = 1): PackingPlan['placements'][number] => ({ itemId: id, copyId: `${id}#${copySequence}`, x: 0, y: 0, z, dimensions: { length: 2, width: 2, height: 2 } });
const basePlan = (): PackingPlan => ({ id: 'comfort', name: '舒适版', placements: [], unplaced: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0 });

describe('detectRisks', () => {
  it('reports overweight and high volume', () => {
    const plan = { ...basePlan(), totalWeight: 11, usedVolume: 460, capacityRatio: 0.96 };
    expect(detectRisks(plan, suitcase, []).map((risk) => risk.id)).toEqual(expect.arrayContaining(['overweight', 'high-volume']));
  });

  it('reports an oversized unplaced copy', () => {
    const huge = item('huge', { length: 11 });
    const plan = { ...basePlan(), unplaced: [{ item: huge, copyId: 'huge#1', reason: '没有可用的连续空间' }] };
    expect(detectRisks(plan, suitcase, [huge]).some((risk) => risk.id === 'oversized-huge')).toBe(true);
  });

  it('reports fragile items with a box stacked above', () => {
    const glass = item('glass', { fragile: true });
    const top = item('top');
    const plan = { ...basePlan(), placements: [placement('glass', 0), placement('top', 2)] };
    expect(detectRisks(plan, suitcase, [glass, top]).some((risk) => risk.id === 'fragile-glass')).toBe(true);
  });

  it('reports heavy items placed high', () => {
    const heavy = item('heavy', { weight: 4 });
    const plan = { ...basePlan(), placements: [placement('heavy', 4)] };
    expect(detectRisks(plan, suitcase, [heavy]).some((risk) => risk.id === 'high-heavy')).toBe(true);
  });

  it('marks an omitted must-have item as critical', () => {
    const required = item('passport', { mustHave: true });
    const plan = { ...basePlan(), unplaced: [{ item: required, copyId: 'passport#1', reason: '空间不足' }] };
    expect(detectRisks(plan, suitcase, [required])).toContainEqual(expect.objectContaining({ id: 'missing-passport', severity: 'critical' }));
  });

  it('only counts a multi-copy must-have as complete when every copy is loaded', () => {
    const socks = item('socks', { mustHave: true, quantity: 3, copies: initialCopies('socks', 3) });
    const partial = { ...basePlan(), placements: [placement('socks', 0, 1)], unplaced: [
      { item: socks, copyId: 'socks#2', reason: '空间不足' },
      { item: socks, copyId: 'socks#3', reason: '空间不足' },
    ] };
    const risk = detectRisks(partial, suitcase, [socks]).find((entry) => entry.id === 'missing-socks');
    expect(risk?.severity).toBe('critical');
    expect(risk?.title).toContain('缺 2 件');
    expect(risk?.message).toContain('3');
  });

  it('stays clear when a multi-copy must-have is fully loaded', () => {
    const socks = item('socks', { mustHave: true, quantity: 2, copies: initialCopies('socks', 2) });
    const plan = { ...basePlan(), placements: [placement('socks', 0, 1), placement('socks', 0, 2)] };
    expect(detectRisks(plan, suitcase, [socks]).some((risk) => risk.id.startsWith('missing-'))).toBe(false);
  });
});
