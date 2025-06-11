<template>
    <div class="left-bar">
        <div class="left-bar-content">
            <div class="left-bar-section">
                <h1>Assets</h1>
                <div class="asset-list">
                    <div class="asset-item" v-for="asset in assets" :key="asset.id" @contextmenu.prevent="assetContextMenu(asset)" tabindex="0" @keydown.delete="deleteAsset(asset.id)" @blur="handleAssetBlur(asset.id)">
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
    </div>
</template>

<script setup lang="ts">
import FooterComp from './FooterComp.vue'
import { ref, type Ref } from 'vue'
import PianorollEditor from './PianorollEditor.vue'
import { v4 as uuidv4 } from 'uuid'

interface Asset {
    name: string
    midi: File
    id: string
}

const assets: Ref<Asset[]> = ref([])

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
</script>

<style scoped>
h1 {
    font-size: 16px;
    margin: 0;
    font-weight: 400;
}

.left-bar {
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
}

.asset-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.asset-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background-color: #393939;
    padding: 4px;
    border-radius: 5px;
    color: #e1e1e1;
}

/* outline on focus */
.asset-item:focus {
    outline: 1px solid #4AA945;
}
</style>