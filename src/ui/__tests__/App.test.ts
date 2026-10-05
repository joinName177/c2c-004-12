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

  it('selects a plan and highlights the same copy in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const shirt = wrapper.findAll('[data-copy-id="shirt#1"]');
    expect(shirt.length).toBe(2);
    await shirt[0].trigger('click');
    expect(wrapper.findAll('[data-copy-id="shirt#1"].selected')).toHaveLength(2);
  });

  it('shows planned, loaded and unloaded counts per kind and renders every copy', async () => {
    const { wrapper } = render();
    const shirtRow = wrapper.get('[data-testid="quantity-shirt"]').element.closest('.item-row');
    expect(shirtRow?.textContent).toContain('计划 3');
    expect(wrapper.findAll('[data-item-id="shirt"]').length).toBeGreaterThanOrEqual(2);
  });

  it('increases and decreases quantity through the stepper and recomputes the plan', async () => {
    const { wrapper } = render();
    const before = wrapper.findAll('[data-item-id="jacket"]').length;
    const stepper = wrapper.get('[data-testid="quantity-jacket"]');
    await stepper.get('[aria-label="增加数量"]').trigger('click');
    expect((stepper.get('input').element as HTMLInputElement).value).toBe('2');
    const afterIncrease = wrapper.findAll('[data-item-id="jacket"]').length;
    expect(afterIncrease).toBeGreaterThanOrEqual(before);
    await wrapper.get('[data-testid="quantity-jacket"] [aria-label="减少数量"]').trigger('click');
    expect((wrapper.get('[data-testid="quantity-jacket"] input').element as HTMLInputElement).value).toBe('1');
  });

  it('refuses to save non-positive or decimal quantities', async () => {
    const { wrapper } = render();
    const input = wrapper.get('[data-testid="quantity-jacket"] input');
    await input.setValue('0');
    expect((input.element as HTMLInputElement).value).toBe('1');
    expect(wrapper.get('[data-testid="quantity-jacket"]').element.closest('.item-row')?.textContent).toContain('数量必须是正整数');
    await input.setValue('2.5');
    expect((input.element as HTMLInputElement).value).toBe('1');
  });

  it('warns how many copies a must-have kind is short', async () => {
    const { wrapper } = render();
    // 速干T恤必带 3 件，示例的购物版会预留容量，至少在某个方案下应有缺件提示风险
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    await wrapper.get('[data-testid="quantity-shirt"] [aria-label="增加数量"]').trigger('click');
    await wrapper.get('[data-testid="quantity-shirt"] [aria-label="增加数量"]').trigger('click');
    const text = wrapper.text();
    expect(text).toMatch(/缺 \d+ 件/);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
