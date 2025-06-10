<template>
    <div class="range-select-container" @mousedown.prevent="handleStartDrag" ref="container">
        <div class="range-select-bar" ref="bar"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, defineEmits} from 'vue';

const emit = defineEmits<{
    (e: 'select', range: { start: number, end: number }): void
}>();

const props = defineProps<{
    scaleX: number
}>();

let startDraggingX = 0;
const start = ref<number>(0);
const end = ref<number>(0);
const bar = ref<HTMLDivElement | null>(null);
const container = ref<HTMLDivElement | null>(null);

const getMouseX = (event: MouseEvent) => {
    const x = (event.clientX - container.value!.getBoundingClientRect().left) / props.scaleX;
    return Math.floor(x / 4) * 4;
}

function handleStartDrag(event: MouseEvent) {
    const mouseX = getMouseX(event);
    start.value = mouseX;
    end.value = mouseX + 4;
    startDraggingX = mouseX;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleEndDrag);
}

function handleDrag(event: MouseEvent) {
    const mouseX = getMouseX(event);
    if (mouseX > startDraggingX) {
        start.value = Math.max(startDraggingX, 0);
        end.value = mouseX + 4;
    } else {
        start.value = Math.max(mouseX,0);
        end.value = startDraggingX+ 4;
    }
    emit('select', { start: start.value, end: end.value });
}

function handleEndDrag(event: MouseEvent) {
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleEndDrag);
    emit('select', { start: start.value, end: end.value });
}


const render = () => {
    if (bar.value) {
        bar.value.style.left = `${start.value * props.scaleX}px`;
        bar.value.style.width = `${(end.value - start.value) * props.scaleX}px`;
    }
}

const unselect = () => {
    start.value = 0;
    end.value = 0;
}


const setRange = (range: { start: number, end: number }) => {
    start.value = range.start;
    end.value = range.end;
}

// adjust bar position and width based on start and end
watch([start, end, () => props.scaleX], render);

defineExpose({
    unselect,
    setRange
})

</script>

<style scoped>

.range-select-container {
    position: relative;
    background-color: #213122f7;
}

.range-select-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background-color: #45A96B;
}
</style>