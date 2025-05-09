<template>
    <div class="app">
        <HeaderComp />
        <div class="section" v-for="section in sections" :key="section.sectionName">
            <h2>{{ section.sectionName }}</h2>
            <div class="section-content" v-if="isSection(section)">
                <TabSwitcher :files="section.items" @select="(file) => handleFileSelect(file, section.sectionName)">
                    <PianorollEditor ref="editors" class="editor" :minPitch="21" :maxPitch="108"></PianorollEditor>
                </TabSwitcher>
            </div>
            <div class="section-content" v-else>
                <TabSwitcher :files="section.groups" @select="(file) => handleGroupFileSelect(file, section)">
                    <EditorGroup 
                        ref="editorGroups"
                        :names="section.groupMembers"
                    />
                </TabSwitcher>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PianorollEditor from './components/PianorollEditor.vue'
import HeaderComp from './components/HeaderComp.vue'
import TabSwitcher from './components/TabSwitcher.vue'
import EditorGroup from './components/EditorGroup.vue'

const editors = ref<InstanceType<typeof PianorollEditor>[]>([])
const editorGroups = ref<InstanceType<typeof EditorGroup>[]>([])

function isSection(section: Section | GroupedSection): section is Section {
    return !('groups' in section)
}

type Section = { sectionName: string, items: string[] }
type GroupedSection = { sectionName: string, groups: string[], groupMembers: string[] }
const sections = ref<(Section | GroupedSection)[]>([])

function handleFileSelect(file: string, dir: string, groupName?: string) {
    const selectedSectionId = sections.value.findIndex(section => section.sectionName === dir)
    console.log(selectedSectionId)
    let path: string
    if (groupName) {
        path = `api/resource/midi/${dir}/${groupName}/${file}`
    } else {
        path = `api/resource/midi/${dir}/${file}`
    }
    try {
        editors.value[selectedSectionId].loadMidiFile(path)
    } catch (e) {
        console.error(e)
    }
}

async function handleGroupFileSelect(file: string, section: GroupedSection) {
    const groupIndex = sections.value.indexOf(section)
    if (groupIndex === -1) return
    
    const editorGroup = editorGroups.value[groupIndex]
    if (!editorGroup) return

    for (const memberName of section.groupMembers) {
        const path = `api/resource/midi/${section.sectionName}/${memberName}/${file}`
        await editorGroup.loadMidiFile(memberName, path)
    }
}

function ls(path: string) {
    return fetch(`api/resource_ls/${path}`).then(res => res.json())
}

function itemNameTrim(name: string) {
    // replaces some_text_0063000.mid with 0063000
    return name.replace(/^.*_(\d+)\.mid$/, '$1')
}

onMounted(async () => {
    // editor.value!.loadMidiFile('api/resource/test.mid');
    const sectionNames = (await ls('midi')).dirs
    // sections.value = await Promise.all(res.dirs.map(async (dir: string) => ({ dir, items: (await ls(`midi/${dir}`)).files})))
    for (const sectionName of sectionNames) {
        const lsResult = await ls(`midi/${sectionName}`)
        if (lsResult.dirs.length > 0) {
            const memberNames = lsResult.dirs
            const allGroups = new Set<string>()
            for (const memberName of memberNames) {
                for (const item of (await ls(`midi/${sectionName}/${memberName}`)).files) {
                    allGroups.add(itemNameTrim(item))
                }
            }
            sections.value.push({ sectionName, groups: Array.from(allGroups), groupMembers: memberNames })
        } else {
            sections.value.push({ sectionName, items: lsResult.files })
        }
    }
});

</script>

<style>
.app {
    flex-direction: column;
    padding-bottom: 20px;
}

.editor-container {
    flex: 1;
    min-height: 0;
    padding: 20px;
}

.editor {
    height: 300px;
}

h2 {
    padding: 20px 80px;
}

.section-content {
    padding: 0 20px;
}
</style>