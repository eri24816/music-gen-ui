import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useStore = defineStore('store', () => {
    const bps = ref(108/60)
    const volume = ref(0.5)
    const midiPort = ref<MIDIOutput | null>(null)
    const useMidiOut = ref(false)
    const midiPorts = ref<MIDIOutputMap>(new Map())

    const setMidiPort = async (port: MIDIOutput) => {
        midiPort.value = port
    }

    watch(useMidiOut, async (newVal) => {
        if (newVal) {
            const midiAccess = await navigator.requestMIDIAccess()
            const ports = midiAccess.outputs
            midiPorts.value = ports
            if (midiPorts.value.size > 0) {
                midiPort.value = midiPorts.value.values().next().value!
            }
        }
    })
    

    return {
        bps,
        volume,
        midiPort,
        midiPorts,
        useMidiOut,
        setMidiPort
    }
}) 