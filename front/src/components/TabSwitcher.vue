<template>
    <div class="tab-switcher">
        <div class="file-list">
            <button 
                v-for="file in files" 
                :key="file"
                :class="['file-btn', { active: selectedFile === file }]"
                @click="selectFile(file)"
            >
                {{ file }}
            </button>
        </div>
        <div class="content">
            <slot></slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
    files: string[]
}>();

const emit = defineEmits<{
    (e: 'select', file: string): void
}>();

const selectedFile = ref(props.files[0]);

const selectFile = (file: string) => {
    selectedFile.value = file;
    emit('select', file);
};

onMounted(() => {
    // select the first file
    if (props.files.length > 0) {
        selectFile(props.files[0]);
    }
})
</script>

<style scoped>
.tab-switcher {
    display: flex;
    height: 100%;
    gap: 16px;
}

.file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.file-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    font-size: 14px;
    white-space: nowrap;
}

.file-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
}

.file-btn.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    color: white;
}

.content {
    flex: 1;
    min-width: 0; /* Prevents flex item from overflowing */
}
</style>
