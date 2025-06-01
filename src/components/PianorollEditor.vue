<template>
    <div class="pianoroll-editor"  @keydown.space.prevent="playOrStop" @wheel="handleWheel" ref="editorDiv">
        <canvas class="pianoroll-canvas" ref="pianorollCanvas" @dragover="handleDragOver" @mousedown="handleMouseDown"
            @contextmenu.prevent></canvas>
        <div class="controls">
            <button class="control-btn" @click.prevent="handlePlayClick" :disabled="!player.isReady">
                {{ player.isReady.value ? (isPlaying ? "⏹" : "▶") : "Loading soundfont..." }}
            </button>
            <button class="control-btn" @click.prevent="saveMidi">💾</button>
            <button class="control-btn" @click.prevent="clear" v-if="editable">🗑️</button>
        </div>

        <div class="loading-overlay" v-if="!player.isReady.value">
            Loading soundfont...<br>
            May take a while on first load.
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue"
import type { Ref } from "vue"
import { labToRgbString, Note, Pianoroll } from "@/utils"
import { player } from "@/player"
import type { INote } from "@/player"

import { Midi } from "@tonejs/midi/src/Midi";

interface DragBehavior {
    mouseDown(event: MouseEvent): void
    mouseMove(event: MouseEvent): void
    mouseUp(event: MouseEvent): void
}

const props = withDefaults(defineProps<{
    editable?: boolean
    minPitch?: number
    maxPitch?: number
}>(), {
    editable: false,
    minPitch: 0,
    maxPitch: 127,
})


const emit = defineEmits([
    'edit',
    'transform',
    'save'
])

const pianorollCanvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let scaleX = 10
let oldScaleX = 10
let shiftX = 10
let oldShiftX = 10
let gap = 3
let pianoroll = ref<Pianoroll>(new Pianoroll())
let cursorPosition = 0
let intervalId: ReturnType<typeof setInterval> | null = null
let dragBehavior: DragBehavior | null = null
const isPlaying = ref(false)
const numPitches = props.maxPitch - props.minPitch + 1
const editorDiv = ref<HTMLDivElement | null>(null)
let isDragging = false
let midiMarkers: {beat: number, text: string}[] = []
let overrideBps: number | null = null

const bps = (() => overrideBps ?? pianoroll.value.bps)

class MoveNoteDragBehavior implements DragBehavior {
    private _note: Note
    public get note(): Note {
        return this._note
    }
    constructor(event: MouseEvent) {
        const noteUnderPointer = pianoroll.value.getNoteAt(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
        )
        if (noteUnderPointer) {
            this._note = noteUnderPointer
        } else {
            this._note = createNote(
                screenToBeat(event.clientX),
                screenToPitch(event.clientY),
            )
            pianoroll.value.addNote(this._note)
            emit("edit", [this._note], [])
            updatePlayerNotes()
        }
        player.playNoteDown({ pitch: this._note.pitch, velocity: this._note.velocity, endTime: 0, startTime: 0 })
    }
    mouseDown(event: MouseEvent) {
        render()
    }
    public mouseMove(event: MouseEvent): void {
        pianoroll.value.removeNote(this._note)
        const newNote = createNote(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
            this._note.velocity,
        )
        pianoroll.value.addNote(newNote)

        if (newNote.pitch !== this._note.pitch) {
            player.playNoteUp({ pitch: this._note.pitch, endTime: 1, startTime: 0, velocity: 0 })
            player.playNoteDown({ pitch: newNote.pitch, velocity: newNote.velocity, endTime: 0, startTime: 0 })
        }
        emit("edit", [newNote], [this._note])
        updatePlayerNotes()
        this._note = newNote
        render()
    }
    public mouseUp(event: MouseEvent): void {
        player.playNoteUp({ pitch: this._note.pitch, endTime: 1, startTime: 0, velocity: 0 })
    }
}

class RemoveNoteDragBehavior implements DragBehavior {
    mouseDown(event: MouseEvent) {
        const noteUnderPointer = pianoroll.value.getNoteAt(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
        )
        if (noteUnderPointer) {
            pianoroll.value.removeNote(noteUnderPointer)
            render()
            emit("edit", [], [noteUnderPointer])
            updatePlayerNotes()
        }
    }
    public mouseMove(event: MouseEvent): void {
        const noteUnderPointer = pianoroll.value.getNoteAt(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
        )
        if (noteUnderPointer) {
            pianoroll.value.removeNote(noteUnderPointer)
            render()
            emit("edit", [], [noteUnderPointer])
            updatePlayerNotes()
        }
    }
    public mouseUp(event: MouseEvent): void { }
}

class CursorDragBehavior implements DragBehavior {
    private _wasPlaying = false;
    public mouseDown(event: MouseEvent): void {
        if (isPlaying.value) {
            stop()
            this._wasPlaying = true
        }
        cursorPosition = Math.max(-2, screenToBeat(event.clientX))
        keepCursorInScreen()
        render()
    }
    public mouseMove(event: MouseEvent): void {
        cursorPosition = Math.max(-2, screenToBeat(event.clientX))
        keepCursorInScreen()
        render()
    }
    public mouseUp(event: MouseEvent): void {
        if (this._wasPlaying) {
            _play()
        }
    }
}

const updatePlayerNotes = (): void => {
    if (!isPlaying.value) {
        return
    }
    const notes: any[] = []
    for (const note of pianoroll.value.getNotes()) {
        notes.push({ pitch: note.pitch, startTime: note.onset / bps(), endTime: (note.onset + note.duration) / bps(), velocity: note.velocity })
    }
    player.stop(true)
    playbackId = player.start({ notes: notes }, cursorPosition / bps() + 0.1)
}

const render = (notify: boolean = true): void => {
    if (!pianoroll || !ctx || !pianorollCanvas.value) return

    if (oldScaleX != scaleX || oldShiftX != shiftX) {
        if (notify) {
            emit("transform", { scaleX, shiftX })
        }
        oldScaleX = scaleX
        oldShiftX = shiftX
    }

    let height = pianorollCanvas.value.clientHeight
    let width = pianorollCanvas.value.clientWidth
    pianorollCanvas.value.height = height
    pianorollCanvas.value.width = width
    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    
    // Draw markers
    const markerColors = ["hsl(90, 60%, 20%)", "hsl(180, 60%, 20%)", "hsl(270, 60%, 20%)", "hsl(45, 60%, 20%)","hsl(0, 60%, 20%)",  "hsl(135, 60%, 20%)", "hsl(225, 60%, 20%)", "hsl(315, 60%, 20%)"]
    // map marker text to color index
    const markerColorMap = new Map<string, number>()
    for (let i = 0; i < midiMarkers.length; i++) {
        const text = midiMarkers[i].text[0]
        if (!markerColorMap.has(text)) {
            markerColorMap.set(text, markerColorMap.size % markerColors.length)
        }
    }
    const markerHeight = 10
    for (let i = 0; i < midiMarkers.length; i++) {
        const start = midiMarkers[i].beat
        const end = i==midiMarkers.length-1 ? pianoroll.value.duration : midiMarkers[i+1].beat
        ctx.beginPath()
        ctx.fillStyle = markerColors[markerColorMap.get(midiMarkers[i].text[0]) ?? 0]
        ctx.rect(beatToCanvas(start), height - markerHeight, beatToCanvas(end) - beatToCanvas(start), markerHeight)
        ctx.fill()
        ctx.fillStyle = "#FFFFFF"   
        ctx.font = "12px Arial"
        ctx.textAlign = "left"
        ctx.fillText(
            midiMarkers[i].text,
            beatToCanvas(start),
            height - markerHeight/2,
        )
    }
    // Draw bar lines
    ctx.strokeStyle = "#333333"
    ctx.fillStyle = "white"
    ctx.font = "14px Arial"
    let barGap: number
    barGap = scaleX * 4

    let startDrawnBar = Math.floor(canvasToBeat(0) * 2) / 2
    let endDrawnBar = Math.floor(canvasToBeat(width) * 2) / 2
    let hop = 0.5
    let hops = [
        [480, 16],
        [300, 8],
        [140, 4],
        [80, 2],
        [40, 1],
    ]
    for (const [ratio, hop_] of hops) {
        if (width/scaleX > ratio) {
            hop = hop_
            startDrawnBar = Math.floor(startDrawnBar / hop) * hop
            endDrawnBar = Math.floor(endDrawnBar / hop) * hop
            break
        }
    }
    startDrawnBar = Math.max(startDrawnBar, 0)
    for (let i = startDrawnBar; i <= endDrawnBar; i += hop) {
        if (i % 4 == 0) {
            ctx.strokeStyle = "#444444"
        } else if (i % 1 == 0) {
            ctx.strokeStyle = "#252525"
        } else {
            ctx.strokeStyle = "#151515"
        }
        ctx.beginPath()
        ctx.moveTo(beatToCanvas(i), 0)
        ctx.lineTo(beatToCanvas(i), height)
        ctx.stroke()
        ctx.fillStyle = "#aaaaaa"
        if (i % 4 == 0) {
            ctx.fillText(
                (i / 4 + 1).toString(),
                beatToCanvas(i) + 5,
                15,
            )
        }
    }

    // Draw MIDI notes
    let noteCount = 0
    const timeLowerBound = Math.max(0, -shiftX)
    const timeUpperBound = width / scaleX - shiftX
    for (const note of pianoroll.value.getNotesBetween(
        timeLowerBound,
        timeUpperBound,
    )) {
        // sustain
        const hue = (note.pitch % 12) * 30.0 / 180 * Math.PI // 30 degrees per semitone
        let lightness = Math.pow(note.velocity / 127, 2) * 128
        // lightness += Math.abs(hue - 120) * 0.4 * (90 - lightness) / 100

        const saturation = 100
        ctx.beginPath()
        ctx.roundRect(
            (note.onset + shiftX) * scaleX + gap,
            pitchToCanvas(note.pitch),
            note.duration * scaleX - 2 * gap,
            height / numPitches,
            1,
        )
        const centering = Math.max(0.2, 1.1 - note.velocity/127)
        ctx.globalAlpha = 0.2
        ctx.fillStyle = labToRgbString(lightness, Math.cos(hue)*128*centering, Math.sin(hue)*128*centering)
        ctx.fill()
        


        ctx.beginPath()
        // onset (square)
        let noteHeight = height / numPitches * Math.exp(note.velocity / 127 * 1.6-0.4)
        ctx.rect(
            (note.onset + shiftX) * scaleX,
            pitchToCanvas(note.pitch) + height/ numPitches/2 - noteHeight/2,
            height / numPitches,
            noteHeight,
        )
        ctx.globalAlpha = 1
        ctx.fillStyle = labToRgbString(lightness, Math.cos(hue)*128, Math.sin(hue)*128)
        ctx.fill()


        noteCount++
    }

    // Draw cursor
    const cursorWidth = 10
    ctx.strokeStyle = "#55FF00"
    for (let i = 0; i < (isPlaying.value ? cursorWidth : 1); i++) {
        ctx.beginPath()
        ctx.globalAlpha = Math.exp(-i / (cursorWidth / 3))
        ctx.moveTo(getCursorCanvasPosition() - i, 0)
        ctx.lineTo(getCursorCanvasPosition() - i, height)
        ctx.stroke()
    }
    ctx.globalAlpha = 1

    //display key of dragging note
    if (dragBehavior instanceof MoveNoteDragBehavior) {
        ctx.fillStyle = "#FFFFFF"
        ctx.font = "12px Arial"
        ctx.textAlign = "left"

        const noteName = getNoteNameFromPitch(dragBehavior.note.pitch)

        ctx.fillText(
            noteName,
            beatToCanvas(dragBehavior.note.onset),
            pitchToCanvas(dragBehavior.note.pitch) - 30,
        )
    }
}

const createNote = (
    onset: number,
    pitch: number,
    velocity: number = 80,
    snap = 0.125,
): Note => {
    onset = Math.round(onset / snap) * snap
    if (onset < 0) {
        onset = 0
    }
    const notesInBar = pianoroll.value.getNotesOnsetBetween(
        onset,
        onset - (onset % 4) + 4,
    )
    let duration = (-onset % 4) + 4
    for (const note of notesInBar) {
        if (note.pitch === pitch) {
            duration = Math.min(duration, note.onset - onset)
        }
    }
    duration = Math.max(Math.round(duration / snap) * snap, snap)
    return new Note(onset, duration, pitch, velocity)
}

const getNoteNameFromPitch = (pitch: number): string => {
    const noteNames = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
    ]
    return noteNames[pitch % 12] + (Math.floor(pitch / 12) - 1)
}

const getCursorCanvasPosition = (): number => {
    let pixel = beatToCanvas(cursorPosition)
    return Math.min(
        Math.max(pixel, 5),
        pianorollCanvas.value!.clientWidth,
    )
}

const beatToCanvas = (beat: number): number => {
    return beat * scaleX + shiftX * scaleX
}

const canvasToBeat = (canvasX: number): number => {
    return (canvasX - shiftX * scaleX) / scaleX
}

const screenToBeat = (screenX: number): number => {
    return canvasToBeat(
        screenX - pianorollCanvas.value!.getBoundingClientRect().left,
    )
}

const screenToCanvas = (screenX: number): number => {
    return (
        screenX - pianorollCanvas.value!.getBoundingClientRect().left
    )
}

const canvasToScreen = (canvasX: number): number => {
    return (
        canvasX + pianorollCanvas.value!.getBoundingClientRect().left
    )
}

const pitchToCanvas = (pitch: number): number => {
    return (
        ((numPitches - pitch + props.minPitch - 1) / numPitches) *
        pianorollCanvas.value!.clientHeight
    )
}

const screenToPitch = (screenY: number): number => {
    let pitch =
        Math.ceil(
            numPitches -
            ((screenY -
                pianorollCanvas.value!.getBoundingClientRect()
                    .top) /
                pianorollCanvas.value!.clientHeight) *
            numPitches,
        ) +
        props.minPitch -
        1
    return Math.max(Math.min(pitch, props.maxPitch), props.minPitch)
}

const handleWheel = (event: WheelEvent): void => {
    event.preventDefault()

    if (event.ctrlKey) {
        let oldPianorollXUnderMouse =
            (event.clientX -
                pianorollCanvas.value!.getBoundingClientRect().left) /
            scaleX -
            shiftX
        scaleX *= Math.exp(event.deltaY / -700)
        scaleX = Math.max(scaleX, 4)
        shiftX =
            (event.clientX -
                pianorollCanvas.value!.getBoundingClientRect().left) /
            scaleX -
            oldPianorollXUnderMouse
        shiftX = Math.min(shiftX, 100 / scaleX)
        event.preventDefault()
    } else {
        shiftX -= (0.5 * event.deltaY) / scaleX
        shiftX = Math.min(shiftX, 100 / scaleX)
    }
    render()
}

const handleMouseDown = (event: MouseEvent): void => {
    // test if mouse on cursor
    const cursorX = getCursorCanvasPosition()
    const pointerX = screenToCanvas(event.clientX)
    if (event.buttons === 1) {
        if (Math.abs(cursorX - pointerX) < 10 || !props.editable) {
            dragBehavior = new CursorDragBehavior()
        } else if (props.editable) {
            dragBehavior = new MoveNoteDragBehavior(event)
        }
    } else if (event.buttons === 2 && props.editable) {
        dragBehavior = new RemoveNoteDragBehavior()
    }

    dragBehavior?.mouseDown(event)
    isDragging = true
}

const handleMouseMove = (event: MouseEvent): void => {
    if (isDragging) {
        dragBehavior?.mouseMove(event)
    }
}

const handleMouseUp = (event: MouseEvent): void => {
    dragBehavior?.mouseUp(event)
    dragBehavior = null
    isDragging = false
}

const handleDragOver = (event: DragEvent): void => {
    if (event.dataTransfer?.types.includes("tool")) {
        event.preventDefault()
    }
}

const playOrStop = (): void => {
    if (isPlaying.value) {
        _stop()
    } else {
        _play()
    }
}

let playbackId = 0
const _play = (): void => {

    isPlaying.value = true
    const notes: any[] = []
    for (const note of pianoroll.value.getNotes()) {
        notes.push({
            pitch: note.pitch,
            startTime: (note.onset) / bps(),
            endTime: (note.onset + note.duration) / bps(),
            velocity: note.velocity,
        })
    }
    const sequence = {
        notes: notes,

    }
    if (player.isPlaying()) {
        player.stop()
    }
    const noteOnCallback = (note: INote) => {
        let updatedCursorPosition = note.startTime * bps()
        if (updatedCursorPosition !== cursorPosition) {
            cursorPosition = updatedCursorPosition
        }
    }
    playbackId = player.start(sequence, cursorPosition / bps(), noteOnCallback)
    player.time = cursorPosition / bps()
    console.log("playing", player.time, sequence)
    player.timeVersion++
    const startTime = Date.now()
    let timeVersion = player.timeVersion
    // move the cursor in the event loop
    intervalId = setInterval(() => {
        if (player.playbackId !== playbackId) {
            stop()
            return
        }
        const elapsedTime = Date.now() - startTime
        if (elapsedTime > 0) {
            cursorPosition += 0.02 * bps()
            keepCursorInScreen()
        }
        render()
    }, 20)
}

const _stop = (): void => {
    console.log("stopping")
    if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
    }
    if (playbackId === player.playbackId) {
        player.stop()
    }
    isPlaying.value = false
}

const stop = (): void => {
    if (isPlaying.value) {
        _stop()
    }
}

const keepCursorInScreen = (): void => {
    // update shiftX to keep cursor in screen
    const margin = Math.min(pianorollCanvas.value!.clientWidth * 0.2, 200)
    const targetCursorX = Math.min(Math.max(margin*0.2, getCursorCanvasPosition()), pianorollCanvas.value!.clientWidth - margin)
    shiftX += (targetCursorX - getCursorCanvasPosition()) / scaleX
}

const saveMidi = (): void => {
    const outputBuffer = pianoroll.value.toMidi().toArray()
    const blob = new Blob([outputBuffer], { type: "audio/midi" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "edited_midi.mid"
    a.click()
    URL.revokeObjectURL(url)
    emit("save")
}

const loadMidiFile = async (fileName: string): Promise<void> => {
    stop()
    cursorPosition = 0
    shiftX = 10
    const response = await fetch(fileName)
    if (!response.ok) {
        clear()
        throw new Error(`Failed to fetch MIDI file: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    pianoroll.value = new Pianoroll(arrayBuffer)
    midiMarkers = []
    const midi = new Midi(arrayBuffer);
    for( const event of midi.header.meta) {
        if (event.type === "marker") {
            midiMarkers.push({beat: event.ticks / midi.header.ppq, text: event.text})
        }
    }
    
    render()

}

const clear = (): void => {
    pianoroll.value = new Pianoroll()
    render()
}

const inBounds = (x: number, y: number): boolean => {
    return (
        x >= 0 &&
        x < pianorollCanvas.value!.clientWidth &&
        y >= 0 &&
        y < pianorollCanvas.value!.clientHeight
    )
}


const handlePlayClick = () => {
    playOrStop()
}

onMounted(() => {
    if (pianorollCanvas.value) {
        ctx = pianorollCanvas.value.getContext("2d")
    }
    render()
    emit("transform", { scaleX, shiftX })


    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
})

onUnmounted(() => {
    stop()
})

watch(pianoroll, (newVal) => {
    render()
})

function transform(transform: { scaleX: number, shiftX: number }, notify: boolean = true) {
    scaleX = transform.scaleX
    shiftX = transform.shiftX
    render(notify)
}

function setBps(newBps: number|null) {
    overrideBps = newBps
    updatePlayerNotes()
}

//expose loadMidiFile to parent
defineExpose({
    loadMidiFile,
    transform,
    setBps
})
</script>

<style scoped>
.pianoroll-editor {
    position: relative;
    min-height: 100px;
}


.pianoroll-canvas {
    position: absolute;
    border: 1px solid black;
    background-color: #000000;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.controls {
    position: absolute;
    bottom: 12px;
    left: 12px;
    display: flex;
    flex-direction: row;
    gap: 8px;
    background: #111111;
    backdrop-filter: blur(8px);
    padding: 4px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.control-btn {
    background: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.2s ease;
}

.control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
}

.control-btn:active {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(0.95);
}

.control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fff;
    font-size: 14px;
    letter-spacing: 0.5px;
    border-radius: 10px;
}
</style>
