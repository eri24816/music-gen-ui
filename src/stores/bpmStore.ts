import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStore = defineStore('bpm', () => {
    const bps = ref(2)
    const volume = ref(0.5)

    return {
        bps,
        volume
    }
}) 