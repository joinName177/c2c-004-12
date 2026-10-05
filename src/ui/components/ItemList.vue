<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { ItemPackingSummary, PackingItem } from '../../core/models';

const props = defineProps<{ items: PackingItem[]; summaries: ItemPackingSummary[] }>();
const emit = defineEmits<{
  remove: [id: string];
  toggle: [id: string, mustHave: boolean];
  quantity: [id: string, quantity: number];
  selectInstance: [id: string, instanceIndex: number];
}>();

const summaryById = computed(() => new Map(props.summaries.map((summary) => [summary.itemId, summary])));
function summaryFor(item: PackingItem): ItemPackingSummary {
  return summaryById.value.get(item.id)
    ?? { itemId: item.id, quantity: item.quantity, packedCount: 0, unpackedCount: item.quantity };
}
const errors = reactive<Record<string, string>>({});

function commitQuantity(item: PackingItem, raw: number) {
  if (!Number.isInteger(raw) || raw <= 0) {
    errors[item.id] = '数量必须是大于 0 的整数';
    return;
  }
  errors[item.id] = '';
  emit('quantity', item.id, raw);
}
</script>

<template>
  <div class="item-list">
    <article v-for="item in items" :key="item.id" class="item-row" :data-item-id="item.id">
      <div class="item-icon">{{ item.category.slice(0, 1) }}</div>
      <div class="item-copy">
        <strong>{{ item.name }}<em v-if="item.quantity > 1" class="qty-badge">×{{ item.quantity }}</em></strong>
        <span>{{ item.length }}×{{ item.width }}×{{ item.height }} cm · {{ item.weight }} kg/件 · 共 {{ (item.weight * item.quantity).toFixed(2) }} kg</span>
        <div class="pack-status" data-testid="pack-status">
          <label class="qty-editor">数量
            <input
              type="number"
              min="1"
              step="1"
              :value="item.quantity"
              :aria-label="`${item.name} 数量`"
              @change="commitQuantity(item, Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <button
            type="button"
            class="status-chip packed"
            :class="{ incomplete: item.mustHave && summaryFor(item).unpackedCount > 0 }"
            :title="item.mustHave && summaryFor(item).unpackedCount > 0 ? `必带物品尚缺 ${summaryFor(item).unpackedCount} 件` : '在摆放图中查看已装入副本'"
            @click="summaryFor(item).packedCount && emit('selectInstance', item.id, 0)"
          >已装 {{ summaryFor(item).packedCount }}/{{ summaryFor(item).quantity }}</button>
          <span class="status-chip unloaded" :class="{ missing: item.mustHave && summaryFor(item).unpackedCount > 0 }">未装 {{ summaryFor(item).unpackedCount }}</span>
        </div>
        <p v-if="errors[item.id]" class="field-error">{{ errors[item.id] }}</p>
      </div>
      <button class="must-button" :class="{ checked: item.mustHave }" type="button" @click="emit('toggle', item.id, !item.mustHave)">{{ item.mustHave ? '必带' : '可选' }}</button>
      <b class="priority">P{{ item.priority }}</b>
      <button class="icon-button" type="button" :aria-label="`删除 ${item.name}`" @click="emit('remove', item.id)">×</button>
    </article>
  </div>
</template>
