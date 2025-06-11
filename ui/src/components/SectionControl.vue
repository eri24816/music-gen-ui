<template>
    <div class="section-container">
        <div class="section" 
            v-for="(section, index) in sections" 
            :key="section.start"
            :style="{
                width: `${(section.end - section.start)*scaleX*4}px`, 
                left: `${section.start*scaleX*4}px`, 
                backgroundColor: computeSectionLabelToColor(section.label)
            }"
        >
            <span v-if="!editingIndex[index]" @dblclick="startEditing(index)">
                {{section.label}} ({{section.end - section.start}})
            </span>
            <div v-else class="edit-container">
                <input
                    v-model="editingText"
                    @blur="handleBlur"
                    @keyup.enter="finishEditing(index)"
                    @keyup.down="focusDropdown"
                    ref="editInput"
                    type="text"
                    class="section-input"
                >
                <div v-if="filteredLabels.length" class="labels-dropdown" ref="dropdownRef">
                    <div 
                        v-for="label in filteredLabels" 
                        :key="label"
                        class="label-option"
                        :class="{ 'selected': label === selectedLabel }"
                        @mousedown.prevent="selectLabel(label, index)"
                        @mouseover="selectedLabel = label"
                    >
                        {{ label }}
                    </div>
                </div>
            </div>
            <div class="section-handle left"  @mousedown="startDrag($event, index, 'start')"></div>
            <div class="section-handle right" v-if="index == sections.length - 1" @mousedown="startDrag($event, index, 'end')"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

const props = defineProps<{
    scaleX: number,
    sections: { start: number, end: number, label: string }[]
}>()

const colorPresets = [
    "hsl(223, 31%, 39%)","hsl(35, 39%, 25%)","hsl(105, 24%, 26%)",
    "hsl(120, 40%, 20%)",
    "hsl(240, 50%, 30%)",
    "hsl(280, 20%, 30%)",
    "hsl(320, 50%, 30%)",
    "hsl(360, 50%, 30%)",
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

function computeSectionLabelToColor(label: string) {
    if (!sectionLabelToColor.value[label]) {
        sectionLabelToColor.value[label] = colorPresets[Object.keys(sectionLabelToColor.value).length]
    }
    return sectionLabelToColor.value[label]
}

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

const editingIndex = ref<{ [key: number]: boolean }>({})
const editingText = ref('')
const editInput = ref<HTMLInputElement[]>([])

const dropdownRef = ref<HTMLElement | null>(null)
const selectedLabel = ref('')
const closeTimeout = ref<number | null>(null)

const uniqueLabels = computed(() => {
    return [...new Set(props.sections.map(s => s.label))]
})

const filteredLabels = computed(() => {
    return uniqueLabels.value
})

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

function startEditing(index: number) {
    editingText.value = props.sections[index].label
    editingIndex.value = { [index]: true }
    nextTick(() => {
        if (editInput.value[index]) {
            editInput.value[index].focus()
        }
    })
}

function finishEditing(index: number) {
    if (editingText.value.trim()) {
        props.sections[index].label = editingText.value.trim()
    }
    editingIndex.value = {}
    editingText.value = ''
}


function handleBlur() {
    closeTimeout.value = window.setTimeout(() => {
        const currentIndex = Object.keys(editingIndex.value)[0]
        if (currentIndex !== undefined) {
            finishEditing(parseInt(currentIndex))
        }
    }, 0)
}

function selectLabel(label: string, index: number) {
    if (closeTimeout.value) {
        clearTimeout(closeTimeout.value)
    }
    editingText.value = label
    finishEditing(index)
}

function focusDropdown() {
    nextTick(() => {
        const dropdown = dropdownRef.value
        if (dropdown && dropdown.firstElementChild) {
            (dropdown.firstElementChild as HTMLElement).focus()
            selectedLabel.value = filteredLabels.value[0]
        }
    })
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

.edit-container {
    position: relative;
    width: 100%;
    height: 100%;
}

.labels-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 150px;
    overflow-y: auto;
    background-color: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 4px;
    z-index: 1000;
    margin: 2px auto;
    width: 90%;
}

.label-option {
    padding: 4px 8px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.label-option:hover,
.label-option.selected {
    background-color: #3a3a3a;
}

.section-input {
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    text-align: center;
    width: 90%;
    outline: none;
}
</style> 