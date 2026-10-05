<script setup lang="ts">
import { computed } from 'vue';
import { instanceId, instanceLabel, type PackingItem, type PackingPlan, type Suitcase } from '../../core/models';
const props = defineProps<{ plan: PackingPlan; suitcase: Suitcase; items: PackingItem[]; view: 'top'|'side'; selectedId?: string }>();
const emit = defineEmits<{ select: [id: string] }>();
const colors = ['#df6d45', '#507d68', '#d8a84e', '#5978a7', '#9d6a83', '#6d7d86'];
const itemIndex = computed(() => new Map(props.items.map((item, index) => [item.id, index])));
const byId = computed(() => new Map(props.items.map((item) => [item.id, item])));
function styleFor(itemId: string, x: number, y: number, length: number, width: number) {
  const maxY = props.view === 'top' ? props.suitcase.width : props.suitcase.height;
  return { left: `${x / props.suitcase.length * 100}%`, top: `${y / maxY * 100}%`, width: `${length / props.suitcase.length * 100}%`, height: `${width / maxY * 100}%`, background: colors[(itemIndex.value.get(itemId) ?? 0) % colors.length] };
}
function keyOf(itemId: string, instanceIndex: number) { return instanceId(itemId, instanceIndex); }
function labelFor(itemId: string, instanceIndex: number) {
  const item = byId.value.get(itemId);
  return item ? instanceLabel(item.name, instanceIndex, item.quantity) : itemId;
}
</script>

<template>
  <div class="projection-card">
    <header><span>{{ view === 'top' ? 'TOP VIEW' : 'SIDE VIEW' }}</span><b>{{ view === 'top' ? '俯视图' : '侧视图' }}</b></header>
    <div class="projection" :class="view">
      <button
        v-for="placement in plan.placements"
        :key="keyOf(placement.itemId, placement.instanceIndex)"
        type="button"
        :data-item-id="placement.itemId"
        :data-instance-id="keyOf(placement.itemId, placement.instanceIndex)"
        :aria-label="labelFor(placement.itemId, placement.instanceIndex)"
        :class="{ selected: keyOf(placement.itemId, placement.instanceIndex) === selectedId }"
        :style="styleFor(placement.itemId, placement.x, view === 'top' ? placement.y : placement.z, placement.dimensions.length, view === 'top' ? placement.dimensions.width : placement.dimensions.height)"
        @click="emit('select', keyOf(placement.itemId, placement.instanceIndex))"
      ><span>{{ placement.instanceIndex + 1 }}</span></button>
    </div>
  </div>
</template>
