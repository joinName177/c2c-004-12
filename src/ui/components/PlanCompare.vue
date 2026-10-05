<script setup lang="ts">
import { computed } from 'vue';
import type { PackingPlan, PlanMode, Suitcase } from '../../core/models';
const props = defineProps<{ plans: Record<PlanMode, PackingPlan>; selected: PlanMode; suitcase: Suitcase }>();
const emit = defineEmits<{ select: [mode: PlanMode] }>();
const totalInstances = (plan: PackingPlan) => plan.itemSummaries.reduce((sum, summary) => sum + summary.quantity, 0);
const orderedModes = computed(() => (['minimal', 'comfort', 'shopping'] as PlanMode[]).map((mode) => props.plans[mode]));
</script>

<template>
  <div class="plan-tabs">
    <button v-for="plan in orderedModes" :key="plan.id" type="button" :data-plan="plan.id" :class="{ active: plan.id === selected }" @click="emit('select', plan.id)">
      <span>{{ plan.id === 'minimal' ? 'LIGHT' : plan.id === 'comfort' ? 'BALANCED' : 'RESERVE' }}</span>
      <strong>{{ plan.name }}</strong>
      <small>已装 {{ plan.placements.length }}/{{ totalInstances(plan) }} 件<span v-if="plan.unplaced.length"> · 未装 {{ plan.unplaced.length }} 件</span> · {{ Math.round(plan.capacityRatio * 100) }}% 空间 · {{ plan.totalWeight.toFixed(1) }}/{{ suitcase.maxWeight }}kg</small>
    </button>
  </div>
</template>
