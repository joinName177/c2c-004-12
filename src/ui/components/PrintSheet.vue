<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem, PackingPlan, Risk, Suitcase } from '../../core/models';
const props = defineProps<{ suitcase: Suitcase; items: PackingItem[]; plan: PackingPlan; risks: Risk[] }>();

const loadedCount = computed(() => {
  const counts = new Map<string, number>();
  for (const placement of props.plan.placements) counts.set(placement.itemId, (counts.get(placement.itemId) ?? 0) + 1);
  return counts;
});
const plannedTotal = computed(() => props.items.reduce((sum, item) => sum + item.quantity, 0));
const loadedTotal = computed(() => props.plan.placements.length);
</script>

<template>
  <section class="print-sheet">
    <h1>行李箱空间规划单</h1>
    <p>{{ suitcase.length }} × {{ suitcase.width }} × {{ suitcase.height }} cm · 限重 {{ suitcase.maxWeight }} kg</p>
    <h2>{{ plan.name }}：计划 {{ plannedTotal }} 件，已装 {{ loadedTotal }} 件，未装 {{ plannedTotal - loadedTotal }} 件 · 已装总重 {{ plan.totalWeight.toFixed(1) }} kg</h2>
    <ol>
      <li v-for="item in items" :key="item.id">
        {{ item.name }} × {{ item.quantity }}（已装 {{ loadedCount.get(item.id) ?? 0 }}，未装 {{ item.quantity - (loadedCount.get(item.id) ?? 0) }}）— {{ (item.weight * (loadedCount.get(item.id) ?? 0)).toFixed(2) }} kg
        <span class="print-checks">
          <template v-for="n in item.quantity" :key="n">{{ n <= (loadedCount.get(item.id) ?? 0) ? '□' : '×' }} </template>
        </span>
      </li>
    </ol>
    <h3>风险提示</h3>
    <p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p>
  </section>
</template>
