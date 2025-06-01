<template>
    <div class="main">
        <div class="center-container">
            <div class="editor-container">
                <PianorollEditor ref="editor" :editable="true" class="editor" />
            </div>
            <SettingsPanel />
        </div>
        <LeftBar />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { marked } from 'marked'
import PianorollEditor from './components/PianorollEditor.vue'
import FooterComp from './components/FooterComp.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useStore } from '@/stores/bpmStore'
import { player } from './player'
import LeftBar from './components/LeftBar.vue'

const editor = ref<InstanceType<typeof PianorollEditor>>()

// Add markdown rendering function
function renderMarkdown(text: string): string {
    return marked(text, { breaks: true })
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
}

h2 {
    padding: 20px 80px;
}

.section-content {
    padding: 0 60px;
}

.section-description {
    padding: 0px 140px 20px 140px;
    margin: -10px 0 20px 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
}
.section{
    margin: 100px 0;
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
</style>