<template>
    <div class="editor-group">
        <div v-for="name in names" :key="name" class="editor-container">
            <h3 class="editor-title">{{ name }}</h3>
            <PianorollEditor 
                ref="editors"
                class="editor" 
                :minPitch="21" 
                :maxPitch="108"
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

const editors = ref<InstanceType<typeof PianorollEditor>[]>([]);

const loadMidiFile = async (name: string, file: string) => {
    const editorIndex = props.names.indexOf(name);
    if (editorIndex === -1) {
        console.error(`Editor with name ${name} not found`);
        return;
    }
    
    try {
        await editors.value[editorIndex].loadMidiFile(file);
    } catch (e) {
        console.error(`Failed to load MIDI file for ${name}:`, e);
    }
};

// Expose the loadMidiFile method to parent components
defineExpose({
    loadMidiFile
});
</script>

<style scoped>
.editor-group {
    display: flex;
    flex-direction: column;
}

.editor-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
