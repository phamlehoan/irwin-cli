<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <p class="vue-island">{{ label }} — client bundle loaded.</p>
</template>

<style scoped>
.vue-island {
  padding: 0.5rem 1rem;
  border: 1px solid #4e73df;
  border-radius: 4px;
  color: #4e73df;
  font-family: system-ui, sans-serif;
}
</style>
