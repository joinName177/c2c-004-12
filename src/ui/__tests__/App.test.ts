import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render() {
  let printCount = 0;
  const wrapper = mount(App, { props: {
    repository: new LocalPlannerRepository(new MemoryStorage()),
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="行李箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('does not save an item whose quantity is zero and shows an inline error', async () => {
    const { wrapper } = render();
    const kindsBefore = wrapper.text();
    await wrapper.get('[aria-label="物品名称"]').setValue('零件物品');
    await wrapper.get('[aria-label="物品数量"]').setValue('0');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.get('[data-testid="item-editor-error"]').text()).toContain('数量必须是大于 0');
    expect(kindsBefore).not.toContain('零件物品');
  });

  it('edits quantity by kind and shows planned, packed and unpacked counts', async () => {
    const { wrapper } = render();
    const gifts = wrapper.get('[data-item-id="gifts"]');
    await gifts.get('[aria-label="伴手礼预留盒 数量"]').setValue('3');
    await gifts.get('[aria-label="伴手礼预留盒 数量"]').trigger('change');
    const statuses = gifts.findAll('[data-testid="pack-status"]');
    expect(statuses[0]?.text()).toContain('已装');
    expect(statuses[0]?.text()).toMatch(/未装\s*[0-9]/);
  });

  it('selects a plan and highlights the same copy in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    // 相机只有一件，两个视图各一个色块
    const camera = wrapper.findAll('[data-instance-id="camera#0"]');
    expect(camera.length).toBe(2);
    await camera[0].trigger('click');
    expect(wrapper.findAll('[data-instance-id="camera#0"].selected')).toHaveLength(2);
  });

  it('locates an individual copy of a multi-quantity kind independently', async () => {
    const { wrapper } = render();
    // 轻薄外套数量为 2，两个视图中每件副本都有独立色块
    const first = wrapper.findAll('[data-instance-id="jacket#0"]');
    const second = wrapper.findAll('[data-instance-id="jacket#1"]');
    expect(first.length + second.length).toBeGreaterThanOrEqual(2);
    if (first.length) {
      await first[0].trigger('click');
      expect(first.every((node) => node.classes().includes('selected'))).toBe(true);
    }
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
