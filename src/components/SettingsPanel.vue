<template>
    <div class="settings-panel">
        <div class="setting-item">
            <label>BPM</label>
            <NullableSlider :min="40" :max="240" v-model="bpm" />
        </div>
        <div class="setting-item">
            <label>Volume</label>
            <SliderComp v-model="store.volume" :min="0" :max="1" :step="0.01" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '@/stores/bpmStore'
import NullableSlider from './NullableSlider.vue'
import SliderComp from './SliderComp.vue'

const store = useStore()
const bpm = computed({
    get: () => store.bps ? Math.round(store.bps * 60.0) : null,
    set: (val) => store.bps = val ? val / 60.0 : null
})
</script>

<style scoped>
.settings-panel {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #2a2a2a;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.setting-item {
    display: flex;
    flex-direction: row;
    gap: 8px;
    justify-content: left;
}

.setting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.setting-label {
    font-size: 14px;
    color: #fff;
}

.setting-item label {
    width: 100px;
}

input[type="range"] {
    width: 100%;
    cursor: pointer;
}

input[type="range"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.bpm-value {
    text-align: center;
    font-size: 12px;
    color: #fff;
}

.bpm-value.disabled {
    opacity: 0.7;
}

</style>
