<script setup lang="ts">
import { computed } from 'vue';
import { instanceLabel, type PackingItem, type PackingPlan, type Risk, type Suitcase } from '../../core/models';
const props = defineProps<{ suitcase: Suitcase; items: PackingItem[]; plan: PackingPlan; risks: Risk[] }>();

const rows = computed(() => props.items.map((item) => {
  const placements = props.plan.placements.filter((placement) => placement.itemId === item.id);
  const packedIndexes = new Set(placements.map((placement) => placement.instanceIndex));
  return {
    item,
    packedCount: placements.length,
    copies: Array.from({ length: item.quantity }, (_, index) => ({
      index,
      label: instanceLabel(item.name, index, item.quantity),
      packed: packedIndexes.has(index),
    })),
  };
}));
const totalPlanned = computed(() => props.items.reduce((sum, item) => sum + item.quantity, 0));
const totalPacked = computed(() => props.plan.placements.length);
const plannedWeight = computed(() => props.items.reduce((sum, item) => sum + item.weight * item.quantity, 0));
</script>

<template>
  <section class="print-sheet">
    <h1>行李箱空间规划单</h1>
    <p>{{ suitcase.length }} × {{ suitcase.width }} × {{ suitcase.height }} cm · 限重 {{ suitcase.maxWeight }} kg</p>
    <h2>{{ plan.name }} · 已装 {{ totalPacked }}/{{ totalPlanned }} 件 · 已装重量 {{ plan.totalWeight.toFixed(2) }} kg / 清单总重 {{ plannedWeight.toFixed(2) }} kg</h2>
    <ol>
      <li v-for="row in rows" :key="row.item.id">
        <strong>{{ row.item.name }} ×{{ row.item.quantity }}{{ row.item.mustHave ? '（必带）' : '' }}</strong>
        — 已装 {{ row.packedCount }}/{{ row.item.quantity }} 件 · {{ (row.item.weight * row.item.quantity).toFixed(2) }} kg
        <span v-if="row.item.mustHave && row.packedCount < row.item.quantity" class="print-missing">必带物品尚缺 {{ row.item.quantity - row.packedCount }} 件</span>
        <ul>
          <li v-for="copy in row.copies" :key="copy.index">{{ copy.packed ? '☑' : '☐' }} {{ copy.label }}</li>
        </ul>
      </li>
    </ol>
    <h3>风险提示</h3>
    <p v-for="risk in risks" :key="risk.id">{{ risk.title }}：{{ risk.message }}</p>
  </section>
</template>
