<template>
    <div class="tab-switcher">
        <div class="file-list">
            <div class="sort-controls">
                <button 
                    class="sort-btn" 
                    @click="toggleSortDirection"
                    :title="sortAscending ? 'Sort Descending' : 'Sort Ascending'"
                >
                    sort by name {{ sortAscending ? '↓' : '↑' }}
                </button>
            </div>
            <button 
                v-for="file in sortedFiles" 
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
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{
    files: string[]
}>();

const emit = defineEmits<{
    (e: 'select', file: string): void
}>();

const sortAscending = ref(true);
const selectedFile = ref(props.files[0]);

const sortedFiles = computed(() => {
    const sorted = [...props.files].sort();
    return sortAscending.value ? sorted : sorted.reverse();
});

const toggleSortDirection = () => {
    sortAscending.value = !sortAscending.value;
};

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
    gap: 16px;
    max-height: 700px;
}

.file-list {
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 0px;
    min-width: 100px;
    margin-right: 16px;
    overflow-y: auto;
}

.file-btn {
    background: transparent;
    border: none;
    border-radius: 0;
    color: rgba(255, 255, 255, 0.8);
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

.sort-controls {
    padding: 0 8px 8px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 8px;
}

.sort-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    padding: 2px 8px;
    transition: all 0.2s ease;
    font-size: 14px;
}

.sort-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
}
</style>
