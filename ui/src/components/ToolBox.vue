<template>
    <div class="toolbox" :style="position">
        <button 
            v-for="tool in tools" 
            :key="tool.name"
            class="tool-button"
            @click="$emit('tool-selected', tool.name)"
        >
            {{ tool.label }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Tool {
    name: string;
    label: string;
}

interface Props {
    tools: Tool[];
    x: number;
    y: number;
}

const props = defineProps<Props>();
defineEmits<{
    (e: 'tool-selected', toolName: string): void;
}>();

const position = computed(() => ({
    left: `${props.x}px`,
    top: `${props.y}px`,
}));
</script>

<style scoped>
.toolbox {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    z-index: 1000;
}

.tool-button {
    padding: 4px 8px;
    background: #45A96B;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
}

.tool-button:hover {
    background: #3d8f5d;
}

.tool-button:active {
    background: #357a50;
}
</style>
