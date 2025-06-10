<template>
    <div class="main">
        <div class="center-container">
            <div class="editor-container">
                <PianorollEditor ref="editor" :editable="true" class="editor" @transform="handleEditorTransform" @select-area="handleSelectArea" @unselect="handleUnselect" :min-pitch="21" :max-pitch="108"/>
                <div class="shift-with-editor-container">
                    <div class="shift-with-editor" ref="shiftWithEditor" >
                        <SectionControl :sections="sections" :scaleX="scaleX" />
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
        <LeftBar />
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

const editor = ref<InstanceType<typeof PianorollEditor>>()
const shiftWithEditor = ref<HTMLDivElement>()

const scaleX = ref(1)
const shiftX = ref(0)

const sections = ref<{ start: number, end: number, label: string }[]>([])

sections.value.push({ start: 0, end: 4, label: "Section 1" })
sections.value.push({ start: 4, end: 8, label: "Section 2" })
sections.value.push({ start: 8, end: 16, label: "Section 3" })

function handleEditorTransform(transform: { scaleX: number, shiftX: number }) {
    console.log(transform)
    shiftWithEditor.value!.style.transform = `translate(${transform.shiftX*transform.scaleX}px, 0px)`
    console.log(shiftWithEditor.value!.style.transform)
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
    { name: 'generate', label: 'Generate' }
])

function handleSelectArea(area: { x: number, y: number, width: number, height: number }) {
    const editorRect = editor.value?.$el.getBoundingClientRect()
    if (!editorRect) return

    // Convert beat position to screen coordinates
    const x = (area.x + area.width) * scaleX.value + shiftX.value * scaleX.value
    
    // Convert pitch to screen coordinates (piano roll uses inverted Y axis)
    const heightPerPitch = editorRect.height / (108 - 21 + 1)
    const y = editorRect.height - ((area.y) * heightPerPitch)

    toolboxPosition.value = { x, y }
    toolboxVisible.value = true
}

function handleUnselect() {
    toolboxVisible.value = false
}

function handleToolSelected(toolName: string) {
    const selection = editor.value?.getSelection()
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
            song_duration: 80*32
        }).then(midi => {
            editor.value!.loadMidiFile(midi)
        })

    }
    
}

</script>

<style scoped>
.main {
    display: flex;
    flex-direction: row;
    background-color: #1D1D1D;
    flex: 1;
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
    overflow: hidden;
    border: 2px solid #414141;
}

.editor-container {
    overflow: hidden;
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
    height: 20px;
    width: 10000px;
}

.shift-with-editor-container {
    position: relative;
    overflow: hidden;
    height: 20px;
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
</style>