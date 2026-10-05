<script setup lang="ts">
import { computed, reactive } from 'vue';
import { isValidQuantity } from '../../core/item-copies';
import type { PackingItem, PackingPlan } from '../../core/models';
const props = defineProps<{ items: PackingItem[]; plan: PackingPlan }>();
const emit = defineEmits<{
  remove: [id: string];
  toggle: [id: string, mustHave: boolean];
  quantity: [id: string, quantity: number];
}>();

const inputErrors = reactive(new Map<string, string>());
const loadedByKind = computed(() => {
  const counts = new Map<string, number>();
  for (const placement of props.plan.placements) counts.set(placement.itemId, (counts.get(placement.itemId) ?? 0) + 1);
  return counts;
});

function step(item: PackingItem, delta: number) {
  inputErrors.delete(item.id);
  emit('quantity', item.id, item.quantity + delta);
}

function onTyping(item: PackingItem, event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!isValidQuantity(value)) inputErrors.set(item.id, '数量必须是正整数');
  else inputErrors.delete(item.id);
}

function onCommit(item: PackingItem, event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (isValidQuantity(value)) {
    inputErrors.delete(item.id);
    emit('quantity', item.id, value);
    return;
  }
  // 零、负数和小数不允许保存：校正回当前数量
  inputErrors.set(item.id, '数量必须是正整数');
  input.value = String(item.quantity);
}
</script>

<template>
  <div class="item-list">
    <article v-for="item in items" :key="item.id" class="item-row">
      <div class="item-icon">{{ item.category.slice(0, 1) }}</div>
      <div class="item-copy">
        <strong>{{ item.name }}</strong>
        <span>{{ item.length }}×{{ item.width }}×{{ item.height }} cm · {{ item.weight }} kg/件</span>
        <span class="kind-counts" :class="{ short: (loadedByKind.get(item.id) ?? 0) < item.quantity }">
          计划 {{ item.quantity }} · 已装 {{ loadedByKind.get(item.id) ?? 0 }} · 未装 {{ item.quantity - (loadedByKind.get(item.id) ?? 0) }}
        </span>
        <small v-if="inputErrors.get(item.id)" class="quantity-error">{{ inputErrors.get(item.id) }}</small>
      </div>
      <div class="quantity-stepper" :data-testid="`quantity-${item.id}`">
        <button type="button" aria-label="减少数量" :disabled="item.quantity <= 1" @click="step(item, -1)">−</button>
        <input type="number" min="1" step="1" aria-label="物品数量" :value="item.quantity" @input="onTyping(item, $event)" @change="onCommit(item, $event)" />
        <button type="button" aria-label="增加数量" @click="step(item, 1)">＋</button>
      </div>
      <button class="must-button" :class="{ checked: item.mustHave }" type="button" @click="emit('toggle', item.id, !item.mustHave)">{{ item.mustHave ? '必带' : '可选' }}</button>
      <b class="priority">P{{ item.priority }}</b>
      <button class="icon-button" type="button" :aria-label="`删除 ${item.name}`" @click="emit('remove', item.id)">×</button>
    </article>
  </div>
</template>
