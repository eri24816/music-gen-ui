<template>
    <div class="user-guide-container" v-if="shown">
        <h1>User Guide</h1>
        <div class="guide-content">
            <img class="img" src="https://i.imgur.com/fX8BEWx.png" alt="Usage" />
            <div class="user-guide">
                <div class="guide-section">
                    <h2>Structure Editor</h2>
                    <p>Define your song structure, which serves as a condition for generation. The structure can be
                        specified beforehand or adjusted during composition.</p>
                    <ul>
                        <li>Drag the left or right edge of a segment to resize it</li>
                        <li>Click a segment to assign its label</li>
                    </ul>
                </div>

                <div class="guide-section">
                    <h2>Piano Roll</h2>
                    <p>The workspace where users and AI collaborate on music. *Note that the seed segment should be composed prior to other segments.*</p>
                    <ul>
                        <li>Space bar: Toggle play</li>
                        <li>Click on empty space: Create a note</li>
                        <li>Drag: Move a note</li>
                        <li>Right-click: Delete a note</li>
                        <li>Scroll wheel: Pan</li>
                        <li>Control + scroll: Zoom</li>
                    </ul>
                </div>

                <div class="guide-section">
                    <h2>Assets</h2>
                    <p>Provides several 8-bar MIDI assets that users can drag into the piano roll.</p>
                    <ul>
                        <li>Drag assets into the piano roll as starting material or to combine with existing composition
                        </li>
                        <li>Import additional assets from your disk</li>
                        <li>Click on an asset to preview it</li>
                    </ul>
                </div>

                <div class="guide-section">
                    <h2>Bar Selection</h2>
                    <p>Enables quick selection of one or multiple bars, which can then be used with the command palette.</p>
                </div>

                <div class="guide-section">
                    <h2>Command Palette</h2>
                    <p>Click <em>Generate!</em> to let the AI generate content for the selected range, or use other buttons
                        to perform different operations.</p>
                </div>
            </div>
        </div>
        The guide can be re-opened later.
        <button @click="closeGuide">Close</button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const shown = ref(true)
const closeGuide = () => {
    shown.value = false
}
const openGuide = () => {
    shown.value = true
}


defineExpose({
    closeGuide,
    openGuide
})
</script>

<style scoped>
.user-guide-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #121212;
    display: flex;
    flex-direction: column;
    padding: 20px;
    z-index: 1000;
}
.guide-content {
    display: flex;
    flex-direction: row;
    gap: 20px;
}
.img{
    width: 40%;
    height: auto;
    object-fit:contain;
}
</style>