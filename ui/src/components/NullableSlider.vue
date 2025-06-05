<template>
    <div class="slider-container">
        <div class="slider-header">
            <label v-if="label">{{ label }}</label>
            <input type="checkbox" v-model="enabled" @change="toggleEnabled" />
        </div>
        <input 
            type="range" 
            :min="min" 
            :max="max" 
            :value="localValue" 
            @input="updateValue" 
        />
        <div class="slider-value" :class="{ disabled: !enabled }">
            {{ enabled ? localValue : 'Unset' }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
    modelValue: number | null;
    min: number;
    max: number;
    label?: string;
    defaultValue?: number;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number | null): void;
}>();

const enabled = ref(props.modelValue !== null);
const localValue = ref(props.modelValue ?? props.defaultValue ?? props.min);

function toggleEnabled() {
    if (!enabled.value) {
        emit('update:modelValue', null);
    } else {
        emit('update:modelValue', localValue.value);
    }
}

function updateValue(event: Event) {
    const target = event.target as HTMLInputElement;
    enabled.value = true;
    localValue.value = Number(target.value);
    if (enabled.value) {
        emit('update:modelValue', localValue.value);
    }
}

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
    if (newValue !== null) {
        localValue.value = newValue;
        enabled.value = true;
    } else {
        enabled.value = false;
    }
}, { immediate: true });
</script>

<style scoped>
.slider-container {
    display: flex;
    align-items: center;
    gap: 5px;
}

.slider-value {
    width: 3em;
}
</style>