import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import { validateItem } from '../core/packing-engine';
import { reconcilePlanForItems, reconcilePlanForQuantity, selectSurvivorIndexes } from '../core/plan-reconcile';
import type { PackingItem, PackingPlan, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }
export type ActionResult = { ok: true } | { ok: false; error: string };

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(loaded.value);
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  // 载入后立即按实际副本重算三套方案，保证刷新后的总数、总重量与副本一致
  const plans = ref(generatePlans(state.suitcase, state.items));
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcase, state.items));

  const save = () => repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  const markStale = () => { isStale.value = true; save(); };

  function addItem(item: PackingItem): ActionResult {
    const errors = validateItem(item);
    if (errors.length) return { ok: false, error: errors[0] };
    state.items.push(item);
    markStale();
    return { ok: true };
  }
  function updateItem(id: string, patch: Partial<PackingItem>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const next = { ...state.items[index], ...patch };
    if (patch.quantity !== undefined) {
      const errors = validateItem(next);
      if (errors.length) return;
    }
    state.items[index] = next as PackingItem;
    markStale();
  }
  function removeItem(id: string) {
    state.items = state.items.filter((item) => item.id !== id);
    plans.value = {
      minimal: reconcilePlanForItems(plans.value.minimal, state.items, state.suitcase),
      comfort: reconcilePlanForItems(plans.value.comfort, state.items, state.suitcase),
      shopping: reconcilePlanForItems(plans.value.shopping, state.items, state.suitcase),
    };
    markStale();
  }
  /**
   * 修改某类物品的计划数量：
   * 撤副本时先撤尚未装入的，再按固定顺序撤已装入的，保留其余副本身份；
   * 三套方案同步对账并重算总数与总重量，不随机改变勾选位置。
   */
  function setItemQuantity(id: string, quantity: number): ActionResult {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return { ok: false, error: '物品不存在' };
    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: '数量必须是大于 0 的整数' };
    const previous = item.quantity;
    if (previous === quantity) return { ok: true };

    // 以当前选中方案为准裁决撤/留哪些副本身份，再统一下发给三套方案
    const nextItems = state.items.map((entry) => entry.id === id ? { ...entry, quantity } : entry);
    const survivors = selectSurvivorIndexes(plans.value[state.selectedPlan], id, previous, quantity);
    plans.value = {
      minimal: reconcilePlanForQuantity(plans.value.minimal, nextItems, id, previous, quantity, survivors),
      comfort: reconcilePlanForQuantity(plans.value.comfort, nextItems, id, previous, quantity, survivors),
      shopping: reconcilePlanForQuantity(plans.value.shopping, nextItems, id, previous, quantity, survivors),
    };
    state.items = nextItems;
    markStale();
    return { ok: true };
  }
  function updateSuitcase(patch: Partial<Suitcase>) { Object.assign(state.suitcase, patch); markStale(); }
  function regenerate() { plans.value = generatePlans(state.suitcase, state.items); isStale.value = false; notice.value = '三套方案已重新计算'; save(); }
  function selectPlan(mode: PlanMode) { state.selectedPlan = mode; save(); }
  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    plans.value = generatePlans(state.suitcase, state.items);
    isStale.value = false;
    notice.value = '已恢复登机箱示例';
    save();
  }

  return { state, notice, isStale, plans, currentPlan, risks, addItem, updateItem, setItemQuantity, removeItem, updateSuitcase, regenerate, selectPlan, resetSample, print: () => printPort.print() };
}
