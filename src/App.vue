<template>
    <div class="app">
        <HeaderComp :title="settings.title" :description="settings.description" />
        <div class="section" v-for="section in sections" :key="section.sectionName">
            <h2 v-html="renderMarkdown(section.sectionName)"></h2>
            <p 
                class="section-description" 
                v-if="settings.sections[section.sectionName]"
                v-html="renderMarkdown(settings.sections[section.sectionName].description)"
            ></p>
            <div class="section-content" v-if="isSection(section)">
                <TabSwitcher :files="section.items" @select="(file) => handleFileSelect(file, section.sectionName)">
                    <PianorollEditor ref="editors" class="editor" :minPitch="21" :maxPitch="108" :editable="false"></PianorollEditor>
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
        <FooterComp />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { marked } from 'marked'
import PianorollEditor from './components/PianorollEditor.vue'
import HeaderComp from './components/HeaderComp.vue'
import TabSwitcher from './components/TabSwitcher.vue'
import EditorGroup from './components/EditorGroup.vue'
import FooterComp from './components/FooterComp.vue'

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
        path = `resource/${dir}/${groupName}/${file}`
    } else {
        path = `resource/${dir}/${file}`
    }
    (editors.value[selectedSectionId] as InstanceType<typeof PianorollEditor>).loadMidiFile(path)
}

async function handleGroupFileSelect(file: string, section: GroupedSection) {
    const groupIndex = sections.value.indexOf(section)
    if (groupIndex === -1) return
    
    const editorGroup = editors.value[groupIndex]
    if (!editorGroup) return

    for (const memberName of section.groupMembers) {
        const path = `resource/${section.sectionName}/${memberName}/${file}`
        await editorGroup.loadMidiFile(memberName, path)
    }
}

let listJson: Record<string, { dirs: string[], files: string[] }> | null = null

async function ls(path: string) {
    return listJson![path]
}

function itemNameTrim(name: string) {
    // replaces some_text_0063000.mid with 0063000
    return name.replace(/^.*_(\d+)\.mid$/, '$1')
}

// Add settings type
interface SectionSettings {
    name: string
    description: string
    order: number
}

const settings = ref<{
    title: string
    description: string
    sections: SectionSettings[]
}>({title: "", description: "", sections: []})

// Add markdown rendering function
function renderMarkdown(text: string): string {
    return marked(text, { breaks: true })
}

onMounted(async () => {
    listJson = await fetch('resource/list.json').then(res => res.json())
    // Load settings
    const settingsResponse = await fetch('resource/settings.json')
    if (settingsResponse.ok) {
        const payload = await settingsResponse.json()
        settings.value = payload
    }

    const sectionNames = (await ls('.')).dirs
    // sections.value = await Promise.all(res.dirs.map(async (dir: string) => ({ dir, items: (await ls(`midi/${dir}`)).files})))
    
    const sectionToOrderMap = new Map<string, number>()
    // default order is 0
    for (const sectionName of sectionNames) {
        sectionToOrderMap.set(sectionName, 0)
    }

    for (const section of settings.value.sections) {
        sectionToOrderMap.set(section.name, section.order)
    }

    const sortedSections = sectionNames.sort((a, b) => sectionToOrderMap.get(a)! - sectionToOrderMap.get(b)!)
    
    for (const sectionName of sortedSections) {
        const lsResult = await ls(`${sectionName}`)
        if (lsResult.dirs.length > 0) {
            const memberNames = lsResult.dirs
            const allGroups = new Set<string>()
            for (const memberName of memberNames) {
                for (const item of (await ls(`${sectionName}/${memberName}`)).files) {
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
:deep(a) {
    color: #58a6ff;
    text-decoration: none;
}

:deep(a:hover) {
    text-decoration: underline;
}

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
}
.section{
    margin: 100px 0;
}
</style>