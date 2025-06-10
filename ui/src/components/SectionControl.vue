<template>
    <div class="section-container">
        <div class="section" 
            v-for="(section, index) in sections" 
            :key="section.start"
            :style="{
                width: `${(section.end - section.start)*scaleX*4}px`, 
                left: `${section.start*scaleX*4}px`, 
                backgroundColor: sectionLabelToColor[section.label]
            }"
        >
            {{section.label}} ({{section.end - section.start}})
            <div class="section-handle left"  @mousedown="startDrag($event, index, 'start')"></div>
            <div class="section-handle right" v-if="index == sections.length - 1" @mousedown="startDrag($event, index, 'end')"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
    scaleX: number,
    sections: { start: number, end: number, label: string }[]
}>()

const colorPresets = [
    "#576DA4","#86612E","#4C7A3C",
    "hsl(120, 40%, 30%)",
    "hsl(240, 50%, 40%)",
    "hsl(280, 20%, 40%)",
    "hsl(320, 50%, 40%)",
    "hsl(360, 50%, 40%)",
    "hsl(40, 50%, 40%)",
    "hsl(80, 10%, 40%)",
    "hsl(140, 60%, 20%)",
    "hsl(380, 60%, 20%)",
    "hsl(160, 40%, 20%)",
    "hsl(260, 60%, 20%)",
    "hsl(340, 60%, 20%)",
    "hsl(200, 60%, 20%)",
    "hsl(300, 60%, 20%)",
]

const sectionLabelToColor = ref<{ [key: string]: string }>({})

// Initialize colors for existing sections
props.sections.forEach(section => {
    if (!sectionLabelToColor.value[section.label]) {
        sectionLabelToColor.value[section.label] = colorPresets[Object.keys(sectionLabelToColor.value).length]
    }
})

const isDragging = ref(false)
const draggedSectionIndex = ref(-1)
const draggedEdge = ref<'start' | 'end'>('start')
const initialMouseX = ref(0)
const initialSectionTime = ref(0)
let lastTime = -1

function startDrag(event: MouseEvent, sectionIndex: number, edge: 'start' | 'end') {
    isDragging.value = true
    draggedSectionIndex.value = sectionIndex
    draggedEdge.value = edge
    initialMouseX.value = event.clientX
    initialSectionTime.value = edge === 'start' 
        ? props.sections[sectionIndex].start 
        : props.sections[sectionIndex].end

    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', stopDrag)
    lastTime = -1
}

function handleDrag(event: MouseEvent) {
    if (!isDragging.value) return

    const deltaX = event.clientX - initialMouseX.value
    const deltaTime = deltaX / (props.scaleX * 4) // Convert pixels to beats

    // Snap to whole numbers
    let newTime = Math.round(Math.max(0, initialSectionTime.value + deltaTime))
    if (lastTime == newTime) return
    
    lastTime = newTime
    const currentSection = props.sections[draggedSectionIndex.value]

    if (draggedEdge.value === 'start') {
        // Don't allow start to go beyond end
        if (newTime > currentSection.end)
            newTime = currentSection.end
        // Update previous section's end if it exists
        if (draggedSectionIndex.value > 0) {
            const prevSection = props.sections[draggedSectionIndex.value - 1]
            if (newTime < prevSection.start) {
                newTime = prevSection.start
            }
            prevSection.end = newTime
        }
        currentSection.start = newTime
    
    } else {
        if (newTime < currentSection.start)
            newTime = currentSection.start
        // Update next section's start if it exists
        if (draggedSectionIndex.value < props.sections.length - 1) {
            const nextSection = props.sections[draggedSectionIndex.value + 1]
            if (newTime > nextSection.end) {
                newTime = nextSection.end
            }
            nextSection.start = newTime
        }
        currentSection.end = newTime
    }
}

function stopDrag() {
    isDragging.value = false
    window.removeEventListener('mousemove', handleDrag)
    window.removeEventListener('mouseup', stopDrag)
    // if a section is too short, delete it
    const toDelete = []
    for (let i = 0; i < props.sections.length; i++) {
        if (props.sections[i].end - props.sections[i].start < 1) {
            toDelete.push(i)
        }
    }
    for (let i = toDelete.length - 1; i >= 0; i--) {
        props.sections.splice(toDelete[i], 1)
    }
}
</script>

<style scoped>
.section-container {
    position:relative;
}
.section {
    position: absolute;
    top: 0;
    left: 0;
    height: 20px;
    line-height: 20px;
    text-align: center;
    user-select: none;
    overflow: hidden;
}

.section-handle {
    position: absolute;
    top: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    background-color: rgb(28, 28, 28);
}

.section-handle:hover {
    background-color: rgb(181, 181, 181);
}

.section-handle.left {
    left: -3px;
}

.section-handle.right {
    right: -3px;
}
</style> 