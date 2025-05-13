<template>
    <div class="editor-group">
        <div v-for="(name, index) in names" :key="name" class="editor-container">
            <h3 class="editor-title">{{ name }}</h3>
            <PianorollEditor 
                ref="editors"
                class="editor" 
                :minPitch="21" 
                :maxPitch="108"
                @transform="(transform) => handleTransform(transform, index)"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PianorollEditor from './PianorollEditor.vue';

const props = defineProps<{
    names: string[]
}>();

function setBps(bps: number|null) {
    // call setBps on all editors
    editors.value.forEach((editor) => {
        editor.setBps(bps)
    })
}

const editors = ref<InstanceType<typeof PianorollEditor>[]>([]);

const loadMidiFile = async (name: string, file: string) => {
    const editorIndex = props.names.indexOf(name);

    try {
        await editors.value[editorIndex].loadMidiFile(file);
    } catch (e) {
        console.error(`Failed to load MIDI file for ${name}:`, e);
    }
};

const handleTransform = (transform: { scaleX: number, shiftX: number }, sourceIndex: number) => {
    if (sourceIndex === -1) return;

    editors.value.forEach((editor, index) => {
        if (index !== sourceIndex) {
            editor.transform(transform, false);
        }
    });
};

// Expose the loadMidiFile method to parent components
defineExpose({
    loadMidiFile,
    setBps
});
</script>

<style scoped>
.editor-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.editor-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.editor-title {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    font-weight: 500;
}

.editor {
    height: 300px;
    border-radius: 12px;
    overflow: hidden;
}
</style>
