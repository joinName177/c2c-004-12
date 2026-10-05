import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import { initialCopies, isValidQuantity, quantityError, resizeCopies } from '../core/item-copies';
import type { PackingItem, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(loaded.value);
  const notice = ref(loaded.warning ?? '');
  const quantityWarning = ref('');
  const isStale = ref(false);
  const plans = ref(generatePlans(state.suitcase, state.items));
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcase, state.items));

  const save = () => repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  const markStale = () => { isStale.value = true; save(); };

  function addItem(item: PackingItem) {
    state.items.push({ ...item, copies: item.copies.length ? item.copies : initialCopies(item.id, item.quantity) });
    markStale();
  }
  function updateItem(id: string, patch: Partial<PackingItem>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...patch } as PackingItem;
    markStale();
  }
  function removeItem(id: string) { state.items = state.items.filter((item) => item.id !== id); markStale(); }

  /**
   * 修改某种物品的数量。零、负数和小数不允许保存；合法数量立即重算三套方案。
   * 数量减少时以当前选中方案为准保留副本身份，绝不随机改变勾选位置。
   */
  function setQuantity(id: string, nextQuantity: number): boolean {
    if (!isValidQuantity(nextQuantity)) {
      quantityWarning.value = quantityError(nextQuantity);
      return false;
    }
    const index = state.items.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const item = state.items[index];
    if (nextQuantity === item.quantity) { quantityWarning.value = ''; return true; }

    const placedCopyIds = new Set(plans.value[state.selectedPlan].placements.map((placement) => placement.copyId));
    const copies = resizeCopies(item.copies, nextQuantity, placedCopyIds);
    state.items[index] = { ...item, quantity: nextQuantity, copies };

    quantityWarning.value = '';
    plans.value = generatePlans(state.suitcase, state.items);
    isStale.value = false;
    notice.value = '数量已更新，三套方案已重新计算';
    save();
    return true;
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

  return {
    state, notice, isStale, quantityWarning, plans, currentPlan, risks,
    addItem, updateItem, removeItem, setQuantity,
    updateSuitcase, regenerate, selectPlan, resetSample,
    print: () => printPort.print(),
  };
}
