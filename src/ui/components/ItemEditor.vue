<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { PackingItem } from '../../core/models';
const emit = defineEmits<{ add: [item: PackingItem] }>();
const draft = reactive({ name: '', category: '衣物', length: 20, width: 15, height: 5, weight: 0.3, quantity: 1, priority: 2 as 1|2|3, mustHave: false, fragile: false });
const error = ref('');
function submit() {
  if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) {
    error.value = '数量必须是大于 0 的整数，零、负数和小数无法保存';
    return;
  }
  error.value = '';
  const name = draft.name.trim() || '未命名物品';
  emit('add', { ...draft, name, id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
  draft.name = '';
  draft.quantity = 1;
}
</script>

<template>
  <form class="item-editor" data-testid="item-editor" @submit.prevent="submit">
    <input v-model="draft.name" aria-label="物品名称" placeholder="添加物品名称" />
    <select v-model="draft.category" aria-label="物品类别"><option>衣物</option><option>鞋履</option><option>数码</option><option>洗护</option><option>随身</option><option>其他</option></select>
    <label class="quantity-field" title="数量（正整数）">数量
      <input v-model.number="draft.quantity" aria-label="物品数量" type="number" min="1" step="1" />
    </label>
    <button type="submit">＋ 添加</button>
    <p v-if="error" class="field-error quantity-error" data-testid="item-editor-error">{{ error }}</p>
  </form>
</template>
