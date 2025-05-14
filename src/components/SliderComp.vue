<template>
    <div class="slider-container">
        <div class="slider-header">
            <label v-if="label">{{ label }}</label>
        </div>
        <input 
            type="range" 
            :min="min" 
            :max="max" 
            :value="modelValue"     
            @input="updateValue" 
            :step="step"
        />
        <div class="slider-value">
            {{ modelValue }}
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    modelValue: number;
    min: number;
    max: number;
    label?: string;
    step?: number;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
}>();

function updateValue(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', Number(target.value));
}
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