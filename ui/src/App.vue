<template>
    <div class="main">
        <div class="center-container">
            <div class="editor-container">
                <PianorollEditor ref="editor" :editable="true" class="editor" @transform="handleEditorTransform" :min-pitch="21" :max-pitch="108"/>
                <div class="shift-with-editor-container">
                    <div class="shift-with-editor" ref="shiftWithEditor" >
                        <SectionControl :sections="sections" :scaleX="scaleX" />
                    </div>
                </div>
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
    return marked.parse(text, { breaks: true })
}

const store = useStore()


watch(() => store.bps, (newBps) => {
    editor.value?.setBps(newBps)
})


watch(() => store.volume, (newVolume) => {
    player.setVolume(newVolume)
})

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
</style>