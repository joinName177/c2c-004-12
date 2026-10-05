import { describe, expect, it } from 'vitest';
import { detectRisks } from '../risk-engine';
import type { PackingItem, PackingPlan, Suitcase } from '../models';

const suitcase: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '其他', length: 2, width: 2, height: 2, weight: 1, quantity: 1, priority: 2, mustHave: false, ...overrides });
const basePlan = (): PackingPlan => ({ id: 'comfort', name: '舒适版', placements: [], unplaced: [], itemSummaries: [], totalWeight: 0, usedVolume: 0, capacityRatio: 0 });

describe('detectRisks', () => {
  it('reports overweight and high volume', () => {
    const plan = { ...basePlan(), totalWeight: 11, usedVolume: 460, capacityRatio: 0.96 };
    expect(detectRisks(plan, suitcase, []).map((risk) => risk.id)).toEqual(expect.arrayContaining(['overweight', 'high-volume']));
  });

  it('reports an oversized unplaced item', () => {
    const huge = item('huge', { length: 11 });
    const plan = { ...basePlan(), unplaced: [{ item: huge, instanceIndex: 0, reason: '没有可用的连续空间' }] };
    expect(detectRisks(plan, suitcase, [huge]).some((risk) => risk.id === 'oversized-huge')).toBe(true);
  });

  it('reports fragile items with a box stacked above', () => {
    const glass = item('glass', { fragile: true });
    const top = item('top');
    const plan = { ...basePlan(), placements: [
      { itemId: 'glass', instanceIndex: 0, x: 0, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } },
      { itemId: 'top', instanceIndex: 0, x: 0, y: 0, z: 2, dimensions: { length: 2, width: 2, height: 2 } },
    ] };
    expect(detectRisks(plan, suitcase, [glass, top]).some((risk) => risk.id === 'fragile-glass#0')).toBe(true);
  });

  it('reports heavy items placed high', () => {
    const heavy = item('heavy', { weight: 4 });
    const plan = { ...basePlan(), placements: [{ itemId: 'heavy', instanceIndex: 0, x: 0, y: 0, z: 4, dimensions: { length: 2, width: 2, height: 2 } }] };
    expect(detectRisks(plan, suitcase, [heavy]).some((risk) => risk.id === 'high-heavy#0')).toBe(true);
  });

  it('marks an omitted must-have item as critical', () => {
    const required = item('passport', { mustHave: true });
    const plan = { ...basePlan(), unplaced: [{ item: required, instanceIndex: 0, reason: '空间不足' }], itemSummaries: [{ itemId: 'passport', quantity: 1, packedCount: 0, unpackedCount: 1 }] };
    expect(detectRisks(plan, suitcase, [required])).toContainEqual(expect.objectContaining({ id: 'missing-passport', severity: 'critical' }));
  });

  it('reports exactly how many copies of a partially packed must-have are missing', () => {
    const medicine = item('medicine', { mustHave: true, quantity: 3, name: '常备药' });
    const plan = {
      ...basePlan(),
      placements: [{ itemId: 'medicine', instanceIndex: 0, x: 0, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } }],
      unplaced: [
        { item: medicine, instanceIndex: 1, reason: '空间不足' },
        { item: medicine, instanceIndex: 2, reason: '空间不足' },
      ],
      itemSummaries: [{ itemId: 'medicine', quantity: 3, packedCount: 1, unpackedCount: 2 }],
    };
    const risks = detectRisks(plan, suitcase, [medicine]);
    const risk = risks.find((entry) => entry.id === 'missing-medicine');
    expect(risk?.severity).toBe('critical');
    expect(risk?.message).toContain('尚缺 2 件');
    expect(risk?.message).toContain('已装入 1 件');
  });

  it('does not flag a must-have risk when every copy is packed', () => {
    const socks = item('socks', { mustHave: true, quantity: 2 });
    const plan = {
      ...basePlan(),
      placements: [
        { itemId: 'socks', instanceIndex: 0, x: 0, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } },
        { itemId: 'socks', instanceIndex: 1, x: 2, y: 0, z: 0, dimensions: { length: 2, width: 2, height: 2 } },
      ],
      itemSummaries: [{ itemId: 'socks', quantity: 2, packedCount: 2, unpackedCount: 0 }],
    };
    expect(detectRisks(plan, suitcase, [socks]).some((risk) => risk.id.startsWith('missing-'))).toBe(false);
  });
});
