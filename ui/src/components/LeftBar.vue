<template>
    <div class="left-bar">
        <div class="left-bar-content">
            <div class="left-bar-section">
                <h1>Assets</h1>
                <div class="asset-list">
                    <div class="asset-item" v-for="asset in assets" :key="asset.id" @contextmenu.prevent="assetContextMenu(asset)" tabindex="0" @keydown.delete="deleteAsset(asset.id)" @blur="handleAssetBlur(asset.id)" @mousedown="handleAssetMouseDown(asset)" :ref="(el: any) => (el ? assetEls[asset.id] = el : delete assetEls[asset.id])">
                        <span>{{ asset.name }}</span>
                        <PianorollEditor :midi="asset.midi" :interactive="false" display="simple" @click="editors[asset.id].playOrStop()" :ref="(el: any) => (el ? editors[asset.id] = el : delete editors[asset.id])" />
                    </div>
                </div>
                <button @click="addAsset">+</button>
            </div>
            <div class="left-bar-section">
                <h1>Suggestions</h1>
                <button>+</button>
            </div>
        </div>

        <FooterComp class="footer"/>

        <div class="asset-item dragging-asset" v-if="draggingAsset" ref="draggingAssetEl">
            <span>{{ draggingAsset.name }}</span>
            <PianorollEditor :midi="draggingAsset.midi" :interactive="false" display="simple"/>
        </div>
    </div>
</template>

<script setup lang="ts">
import FooterComp from './FooterComp.vue'
import { ref, type Ref } from 'vue'
import PianorollEditor from './PianorollEditor.vue'
import { v4 as uuidv4 } from 'uuid'
import { defineEmits, onMounted } from 'vue'
import type { Pianoroll } from '@/utils'


const emit = defineEmits<{
    (e: 'drag-asset', pianoroll: Pianoroll, mouseEvent: MouseEvent): void
    (e: 'drag-asset-end', pianoroll: Pianoroll, mouseEvent: MouseEvent): void
}>()

interface Asset {
    name: string
    midi: File
    id: string
}

const assets: Ref<Asset[]> = ref([])
const assetEls: Ref<Record<string, HTMLDivElement>> = ref({})

const draggingAsset: Ref<Asset | null> = ref(null)
const draggingAssetEl: Ref<HTMLDivElement | null> = ref(null)

const editors: Ref<Record<string, InstanceType<typeof PianorollEditor>>> = ref({})

const addAsset = () => {
    // select a file
    const file = document.createElement('input')
    file.type = 'file'
    file.accept = 'audio/midi'
    file.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
            assets.value.push({ name: file.name, midi: file, id: uuidv4() })
        }
    }
    file.click()
}

const deleteAsset = (id: string) => {
    assets.value = assets.value.filter(asset => asset.id !== id)
    delete editors.value[id]
}

const assetContextMenu = (asset: Asset) => {
    console.log(asset)
}

const handleAssetBlur = (id: string) => {
    editors.value[id].stop()
}

let startX: number|null = null
let startY: number | null = null
let mouseMoved = false

const handleAssetMouseDown = (asset: Asset) => {

    draggingAsset.value = asset
    mouseMoved = false
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e: MouseEvent) => {
    if (!draggingAssetEl.value) {
        return
    }
    mouseMoved = true
    if (startX === null) {
        startX = e.clientX - assetEls.value[draggingAsset.value!.id]!.getBoundingClientRect().left
    }
    if (startY === null) {
        startY = e.clientY - assetEls.value[draggingAsset.value!.id]!.getBoundingClientRect().top
    }
    // move the asset to the mouse position
    const rect = draggingAssetEl.value!.getBoundingClientRect()
    if (rect) {
        draggingAssetEl.value!.style.left = `${e.clientX - startX}px`
        draggingAssetEl.value!.style.top = `${e.clientY - startY}px`
    }   
    emit('drag-asset', editors.value[draggingAsset.value!.id].getPianoroll(), e)
}

const handleMouseUp = (e: MouseEvent) => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    if (mouseMoved) {
        emit('drag-asset-end', editors.value[draggingAsset.value!.id].getPianoroll(),e )
    }
    draggingAsset.value = null
}

</script>

<style scoped>
h1 {
    font-size: 16px;
    margin: 0;
    font-weight: 400;
}

.left-bar {
    position:relative;
    background-color: #0B0B0B;
    padding:  10px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}


.left-bar-section {
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 70vh;
}

.asset-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    padding: 2px;
}

.asset-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background-color: #000000;
    padding: 4px;
    border-radius: 5px;
    color: #e1e1e1;
}

/* outline on focus */
.asset-item:focus {
    outline: 1px solid #4AA945;
}

.dragging-asset {
    position: fixed;
    top: -500px;
    left: -500px;
    width: 300px;
    outline: 1px solid #4AA945;
    opacity: 0.5;
}
</style>