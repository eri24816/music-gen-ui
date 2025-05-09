<template>
    <div class="app">
        <HeaderComp />
        <div class="section" v-for="section in sections" :key="section.sectionName">
            <h2>{{ section.sectionName }}</h2>
            <p class="section-description" v-if="sectionDescriptions[section.sectionName]">
                {{ sectionDescriptions[section.sectionName].description }}
            </p>
            <div class="section-content" v-if="isSection(section)">
                <TabSwitcher :files="section.items" @select="(file) => handleFileSelect(file, section.sectionName)">
                    <PianorollEditor ref="editors" class="editor" :minPitch="21" :maxPitch="108"></PianorollEditor>
                </TabSwitcher>
            </div>
            <div class="section-content" v-else>
                <TabSwitcher :files="section.groups" @select="(file) => handleGroupFileSelect(file, section)">
                    <EditorGroup 
                        ref="editors"
                        class="editor-group"
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

const editors = ref<InstanceType<typeof PianorollEditor|typeof EditorGroup>[]>([])

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
    editors.value[selectedSectionId].loadMidiFile(path)
}

async function handleGroupFileSelect(file: string, section: GroupedSection) {
    const groupIndex = sections.value.indexOf(section)
    if (groupIndex === -1) return
    
    const editorGroup = editors.value[groupIndex]
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

// Add settings type
interface SectionSettings {
    description: string
}

const sectionDescriptions = ref<Record<string, SectionSettings>>({})

onMounted(async () => {
    // Load settings
    try {
        const settingsResponse = await fetch('api/resource/settings.json')
        if (settingsResponse.ok) {
            sectionDescriptions.value = await settingsResponse.json()
        }
    } catch (e) {
        console.error('Failed to load settings:', e)
    }

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

<style scoped>
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
    padding: 0 60px;
}


.section-description {
    padding: 0px 140px 20px 140px;
    margin: -10px 0 20px 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    white-space: pre-line; /* Preserves line breaks from settings */
}
.section{
    margin: 100px 0;
}
</style>