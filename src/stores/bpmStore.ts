import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBpmStore = defineStore('bpm', () => {
    const bps = ref<number|null>(null)

    return {
        bps
    }
}) 