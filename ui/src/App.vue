<template>
    <div class="main" tabindex="0" @keydown="handleKeyDown">
        <div class="center-container">
            <div class="editor-container">
                <PianorollEditor ref="editor" :editable="true" class="editor" @transform="handleEditorTransform" @select-range="handleEditorSelectRange" @unselect-range="handleUnselectRange" :min-pitch="21" :max-pitch="108"/>
                <div class="shift-with-editor-container">
                    <div class="shift-with-editor" ref="shiftWithEditor" >
                        <RangeSelect :scaleX="scaleX" class="range-select" ref="rangeSelect" @select="handleSelectRange"/>
                        <SectionControl :sections="sections" :scaleX="scaleX" class="section-control"/>
                    </div>
                </div>
                <ToolBox 
                    v-if="toolboxVisible"
                    :x="toolboxPosition.x"
                    :y="toolboxPosition.y"
                    :tools="tools"
                    @tool-selected="handleToolSelected"
                    class="toolbox"
                />
            </div>
            <SettingsPanel class="settings-panel" />
        </div>
        <LeftBar @drag-asset="handleDragAsset" @drag-asset-end="handleDragAssetEnd" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { marked } from 'marked'
import PianorollEditor from './components/PianorollEditor.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useStore } from '@/stores/bpmStore'
import { player } from './player'
import LeftBar from './components/LeftBar.vue'
import SectionControl from './components/SectionControl.vue'
import ToolBox from './components/ToolBox.vue'
import { generate } from './api'
import RangeSelect from './components/RangeSelect.vue'
import type { Pianoroll } from './utils'
import { Note } from './utils'

const editor = ref<InstanceType<typeof PianorollEditor>>()
const shiftWithEditor = ref<HTMLDivElement>()
const rangeSelect = ref<InstanceType<typeof RangeSelect>>()

const selectedRange = ref<{ start: number, end: number } | null>(null)

const scaleX = ref(1)
const shiftX = ref(0)

const sections = ref<{ start: number, end: number, label: string }[]>([])
const defaultSectionString = "Intro:4 A:16 B:8 C:8 A:8 B:8 Outro:8"
let start = 0
for (const section of defaultSectionString.split(" ")) {
    const [label, duration] = section.split(":")
    sections.value.push({ start: start, end: start + parseInt(duration), label: label })
    start += parseInt(duration)
}

function handleEditorTransform(transform: { scaleX: number, shiftX: number }) {
    shiftWithEditor.value!.style.transform = `translate(${transform.shiftX*transform.scaleX}px, 0px)`
    scaleX.value = transform.scaleX
    shiftX.value = transform.shiftX
}

// Fix the marked function type issue
function renderMarkdown(text: string): string {
    return marked.parse(text, { breaks: true }) as string
}

const store = useStore()


watch(() => store.bps, (newBps) => {
    editor.value?.setBps(newBps)
})


watch(() => store.volume, (newVolume) => {
    player.setVolume(newVolume)
})

const toolboxVisible = ref(false)
const toolboxPosition = ref({ x: 0, y: 0 })
const tools = ref([
    { name: 'generate', label: 'Generate' },
    { name: 'add-section', label: 'Add Section' }
])

function handleEditorSelectRange(start: number, end: number) {
    rangeSelect.value!.setRange({ start: start, end: end })
    selectedRange.value = { start: start, end: end }
}

function handleSelectRange(range: { start: number, end: number }) {
    editor.value?.selectRange(range)
    selectedRange.value = range
}

watch([selectedRange, shiftX, scaleX], () => {
    if (selectedRange.value) {
        ShowToolbox()
    } else {
        toolboxVisible.value = false
    }
})

function ShowToolbox() {
    toolboxVisible.value = true
    toolboxPosition.value = { x: selectedRange.value!.end * scaleX.value + shiftX.value * scaleX.value + 10, y: editor.value?.$el.getBoundingClientRect().height - 150 }
}

function handleUnselectRange(range: { start: number, end: number }) {
    toolboxVisible.value = false
    rangeSelect.value!.unselect()
    selectedRange.value = null
}

function handleToolSelected(toolName: string) {
    const selection = editor.value?.getSelectionBox()
    if (!selection) return
    
    // Handle tool actions
    if (toolName === 'generate') {
        // Emit or handle generate action
        console.log('Generate requested for area:', selection)
        generate(editor.value!.getMidi(), {
            range_to_generate: { 
                start_beat: selection.x, 
                end_beat: selection.x + selection.width
            },
            segments: sections.value.map(s => ({
                start_bar: s.start,
                end_bar: s.end,
                label: s.label
            })),
            song_duration: sections.value.reduce((max, s) => Math.max(max, s.end), 0)*32
        }).then(async (response: Response) => {
            const reader = response.body!.getReader()
            const decoder = new TextDecoder()
            
            // Clear the existing notes in the range
            const pianoroll = editor.value!.getPianoroll()
            const notesToRemove = pianoroll.getNotesOnsetBetween(selection.x, selection.x + selection.width)
            for (const note of notesToRemove) {
                pianoroll.removeNote(note)
            }

            const lastNoteOfPitch = new Map<number, Note>()
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const noteData = JSON.parse(decoder.decode(value))
                let duration = 0
                if (noteData[3] == 0) {
                    duration = 32 - noteData[0] % 32
                } else {
                    duration = noteData[3]
                }
                const pitch = noteData[1]
                const note = new Note(noteData[0] / 8, duration / 8, noteData[1], noteData[2])

                const last = lastNoteOfPitch.get(pitch)
                if (last) {
                    if(last.onset + last.duration > note.onset) {
                        last.duration = note.onset - last.onset
                    }
                }

                pianoroll.addNote(note)
                lastNoteOfPitch.set(noteData[1], note)
                editor.value!.render()
                editor.value!.updatePlayerNotes()
            }
        })

    } else if (toolName === 'add-section') {
        sections.value.push({ start: selection.x / 4, end: (selection.x + selection.width) / 4, label: `Section ${sections.value.length + 1}` })
    }


    
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space') {
        event.preventDefault(); // Prevent page scroll
        editor.value?.playOrStop()
    }
}

function handleDragAsset(pianoroll: Pianoroll, mouseEvent: MouseEvent) {
    // try to fit the asset into the editor
    const startBeat = Math.round(editor.value!.screenToBeat(mouseEvent.clientX)/4) * 4
    const endBeat = startBeat + pianoroll.duration
    editor.value!.selectRange({ start: startBeat, end: endBeat })
    rangeSelect.value!.setRange({ start: startBeat, end: endBeat })
    selectedRange.value = { start: startBeat, end: endBeat }
    ShowToolbox()
}

function handleDragAssetEnd(pianoroll: Pianoroll, mouseEvent: MouseEvent) {
    // add the asset to the editor
    editor.value!.getPianoroll().overlap(pianoroll, Math.round(editor.value!.screenToBeat(mouseEvent.clientX) / 4) * 4)
    editor.value!.render()
}

</script>

<style scoped>
.main {
    display: flex;
    flex-direction: row;
    background-color: #1D1D1D;
    flex: 1;
    outline: none; /* Remove focus outline if desired */
}

.left-bar {
    flex-basis: 345px;
}

:deep(a) {
    color: #58a6ff;
    text-decoration: none;
}

:deep(a:hover) {
    text-decoration: underline;
}


.editor {
    height: 570px;
    border-radius: 6px 6px 0 0;
    border: 2px solid #414141;
}

.editor-container {
    position: relative;
}

h2 {
    padding: 20px 80px;
}

.footer {
    height: 50px;
}

.center-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 40px 66px;
    gap: 20px;
}

.shift-with-editor {
    
    position: absolute;
    height: 40px;
    width: 10000px;
}

.shift-with-editor-container {
    position: relative;
    overflow-x: clip;
    overflow-y: visible;
    height: 40px;
}

.settings-panel {
    margin-top: auto;
    margin-bottom: auto;
}

.toolbox {
    position: absolute;
    top: 0;
    left: 0;
}

.range-select {
    height: 15px;
}

.section-control {
    width: 100%;
    height: 20px;
    background-color: #000000;
}

</style>