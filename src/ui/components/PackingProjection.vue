<script setup lang="ts">
import { computed } from 'vue';
import { copySequence } from '../../core/item-copies';
import type { PackingItem, PackingPlan, Suitcase } from '../../core/models';
const props = defineProps<{ plan: PackingPlan; suitcase: Suitcase; items: PackingItem[]; view: 'top'|'side'; selectedId?: string }>();
const emit = defineEmits<{ select: [copyId: string] }>();
const colors = ['#df6d45', '#507d68', '#d8a84e', '#5978a7', '#9d6a83', '#6d7d86'];
const itemIndex = computed(() => new Map(props.items.map((item, index) => [item.id, index])));
const byId = computed(() => new Map(props.items.map((item) => [item.id, item])));
function styleFor(itemId: string, x: number, y: number, length: number, width: number) {
  const maxY = props.view === 'top' ? props.suitcase.width : props.suitcase.height;
  return { left: `${x / props.suitcase.length * 100}%`, top: `${y / maxY * 100}%`, width: `${length / props.suitcase.length * 100}%`, height: `${width / maxY * 100}%`, background: colors[(itemIndex.value.get(itemId) ?? 0) % colors.length] };
}
function labelFor(placement: PackingPlan['placements'][number]) {
  const item = byId.value.get(placement.itemId);
  return item ? `${item.name} 第 ${copySequence(placement.copyId)} 件` : placement.copyId;
}
</script>

<template>
  <div class="projection-card">
    <header><span>{{ view === 'top' ? 'TOP VIEW' : 'SIDE VIEW' }}</span><b>{{ view === 'top' ? '俯视图' : '侧视图' }}</b></header>
    <div class="projection" :class="view">
      <button v-for="placement in plan.placements" :key="placement.copyId" type="button"
        :data-item-id="placement.itemId" :data-copy-id="placement.copyId"
        :class="{ selected: placement.copyId === selectedId }"
        :title="labelFor(placement)" :aria-label="labelFor(placement)"
        :style="styleFor(placement.itemId, placement.x, view === 'top' ? placement.y : placement.z, placement.dimensions.length, view === 'top' ? placement.dimensions.width : placement.dimensions.height)"
        @click="emit('select', placement.copyId)">
        <span>{{ copySequence(placement.copyId) }}</span>
      </button>
    </div>
  </div>
</template>
