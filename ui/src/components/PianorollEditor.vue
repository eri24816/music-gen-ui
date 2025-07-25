<template>
    <div class="pianoroll-editor"  @wheel="handleWheel" ref="editorDiv">
        <canvas class="pianoroll-canvas" ref="pianorollCanvas" @dragover="handleDragOver" @mousedown="handleMouseDown"
            @contextmenu.prevent></canvas>
        <!--
        <div class="controls">
            <button class="control-btn" @click.prevent="handlePlayClick" :disabled="!player.isReady">
                {{ player.isReady.value ? (isPlaying ? "⏹" : "▶") : "Loading soundfont..." }}
            </button>
            <button class="control-btn" @click.prevent="saveMidi">💾</button>
            <button class="control-btn" @click.prevent="clear" v-if="editable">🗑️</button>
        </div>
        -->

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
import { getPlayer } from "@/player"
import type { INote } from "@/player"

import { Midi } from "@tonejs/midi/src/Midi";

interface DragBehavior {
    mouseDown(event: MouseEvent): void
    mouseMove(event: MouseEvent): void
    mouseUp(event: MouseEvent): void
}

const props = withDefaults(defineProps<{
    editable?: boolean
    interactive?: boolean
    minPitch?: number
    maxPitch?: number
    midi?: File
    display?: "simple" | "standard"
}>(), {
    editable: false,
    interactive: true,
    minPitch: undefined,
    maxPitch: 127,
    midi: undefined,
    display: "standard",
})


const emit = defineEmits([
    'edit',
    'transform',
    'save',
    'select-range',
    'select-notes',
    'unselect-range',
    'unselect-notes'
])

const pianorollCanvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let minPitch = 0
let maxPitch = 127
let scaleX = 10
let oldScaleX = 10
let shiftX = 10
let oldShiftX = 10
let pianoroll = new Pianoroll()
let cursorPosition = 0
let intervalId: ReturnType<typeof setInterval> | null = null
let dragBehavior: DragBehavior | null = null
const isPlaying = ref(false)
let numPitches = maxPitch - minPitch + 1
const editorDiv = ref<HTMLDivElement | null>(null)
let isDragging = false
let midiMarkers: {beat: number, text: string}[] = []
let overrideBps: number | null = null
let selectionBox: { x: number, y: number, width: number, height: number } | null = null
let selectedNotes: Note[] = []
let selectedRange: { start: number, end: number } | null = null
let player = getPlayer()

onMounted(async () => {
    minPitch = props.minPitch ?? 0
    maxPitch = props.maxPitch ?? 127

    if (props.midi) {
        await loadMidiFile(props.midi)
    }
    

    if (pianorollCanvas.value) {
        ctx = pianorollCanvas.value.getContext("2d")
    }
    scaleX = pianorollCanvas.value!.clientWidth / 20
    shiftX = pianorollCanvas.value!.clientWidth / 1200
    emit("transform", { scaleX, shiftX })

    if (!props.interactive) {
        if (props.midi) {
            // fit pitch
            minPitch = Math.min(...pianoroll.getNotes().map(note => note.pitch))
            maxPitch = Math.max(...pianoroll.getNotes().map(note => note.pitch))
            // fit duration
            const numBeats = pianoroll.duration
            
            scaleX = pianorollCanvas.value!.clientWidth / numBeats
        }
    }
    
    numPitches = maxPitch - minPitch + 1

    render()
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
})

onUnmounted(() => {
    stop()
})

const setSelectionBox = (selection_:{x: number, y: number, width: number, height: number} | null) => {
    selectionBox = selection_
    render()
}
const getSelectionBox = () => {
    if (selectionBox == null) {
        return null
    }
    return {x:selectionBox.x, y:selectionBox.y, width:selectionBox.width, height:selectionBox.height}
}



const unselectRange = () => {
    selectedRange = null
    emit("unselect-range", 0, 0)
}

const bps = (() => overrideBps ?? pianoroll.bps)

class MoveNoteDragBehavior implements DragBehavior {
    private _notes: Note[]
    private _startDraggingPitch: number
    private _startDraggingBeat: number
    private _originalNotes: Note[]
    public get note(): Note {
        return this._notes[0] || null
    }
    constructor(event: MouseEvent) {
        console.log(selectedNotes)
        const noteUnderPointer = pianoroll.getNoteAt(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
        )
        if (noteUnderPointer) {
            if(selectedNotes.includes(noteUnderPointer)) {
                this._notes = selectedNotes.slice()
            } else {
                this._notes = [noteUnderPointer]
            }
        } else {
            this._notes = [createNote(
                screenToBeat(event.clientX),
                screenToPitch(event.clientY),
            )]
            pianoroll.addNote(this._notes[0])
            selectedNotes = []
            emit("edit", [this._notes[0]], [])
            updatePlayerNotes()
        }
        this._originalNotes = [...this._notes]
        this._startDraggingBeat = screenToBeat(event.clientX)
        this._startDraggingPitch = screenToPitch(event.clientY)
        player.playNoteDown({ pitch: this._notes[0].pitch, velocity: this._notes[0].velocity, endTime: 0, startTime: 0 })
    }
    mouseDown(event: MouseEvent) {
        render()
    }
    public mouseMove(event: MouseEvent): void {
        for (const note of this._notes) {
            pianoroll.removeNote(note)
        }
        let pitchDelta = screenToPitch(event.clientY) - this._startDraggingPitch
        let beatDelta = screenToBeat(event.clientX) - this._startDraggingBeat
        // limit pitchDelta so that (min(originalPitch)+pitchDelta) > minPitch
        // and (max(originalPitch)+pitchDelta) < maxPitch
        const pitchDeltaMin = minPitch - Math.min(...this._originalNotes.map(note => note.pitch))
        const pitchDeltaMax = maxPitch - Math.max(...this._originalNotes.map(note => note.pitch))
        pitchDelta = Math.min(pitchDeltaMax, pitchDelta)
        pitchDelta = Math.max(pitchDeltaMin, pitchDelta)
        // limit beatDelta so that (min(originalBeat)+beatDelta) > 0    
        const beatDeltaMin = -Math.min(...this._originalNotes.map(note => note.onset))
        beatDelta = Math.max(beatDeltaMin, beatDelta)
        const newNotes: Note[] = []
        for (const [i, note] of this._notes.entries()) {
            const newNote = createNote(
                this._originalNotes[i].onset + beatDelta,
                this._originalNotes[i].pitch+pitchDelta,
                note.velocity,
                this._originalNotes[i].duration,
            )
            newNotes.push(newNote)
            pianoroll.addNote(newNote)
        }
        if (this._notes.length == 1 && this._notes[0].pitch != newNotes[0].pitch) {
            player.playNoteUp({ pitch: this._notes[0].pitch, endTime: 1, startTime: 0, velocity: 0 })
            player.playNoteDown({ pitch: newNotes[0].pitch, velocity: newNotes[0].velocity, endTime: 0, startTime: 0 })
        }
        if (selectedNotes.length) {
            selectedNotes = newNotes
        }
        updatePlayerNotes()
        this._notes = newNotes
        render()
    }
    public mouseUp(event: MouseEvent): void {
        player.playNoteUp({ pitch: this._notes[0].pitch, endTime: 1, startTime: 0, velocity: 0 })
    }
}

class RemoveNoteDragBehavior implements DragBehavior {
    mouseDown(event: MouseEvent) {
        const noteUnderPointer = pianoroll.getNoteAt(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
        )
        if (noteUnderPointer) {
            if (selectedNotes.includes(noteUnderPointer)) {
                for (const note of selectedNotes) {
                    pianoroll.removeNote(note)
                }
                emit("edit", [], selectedNotes)
            } else {
                pianoroll.removeNote(noteUnderPointer)
                emit("edit", [], [noteUnderPointer])
            }
            updatePlayerNotes()
        }
        if (selectedRange) {
            emit("unselect-range", selectedRange.start, selectedRange.end)
        }
        if (selectedNotes.length > 0) {
            emit("unselect-notes", selectedNotes)
        }
        selectedNotes = []
        setSelectionBox(null)
        unselectRange()
        render()
    }
    public mouseMove(event: MouseEvent): void {
        const noteUnderPointer = pianoroll.getNoteAt(
            screenToBeat(event.clientX),
            screenToPitch(event.clientY),
        )
        if (noteUnderPointer) {
            pianoroll.removeNote(noteUnderPointer)
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

class SelectionDragBehavior implements DragBehavior {
    private _x: number = 0
    private _y: number = 0
    private _width: number = 0
    private _height: number = 0
    public mouseDown(event: MouseEvent): void {
        this._x = screenToBeat(event.clientX)
        this._y = screenToPitch(event.clientY)
        this._width = 0
        this._height = 0
    }
    public mouseMove(event: MouseEvent): void {
        this._width = screenToBeat(event.clientX) - this._x
        this._height = screenToPitch(event.clientY) - this._y
        setSelectionBox({ x: this._x, y: this._y, width: this._width, height: this._height })
        selectedNotes = []
        if (Math.abs(this._height) > 5 || Math.abs(this._width) < 3) {
            for (const note of pianoroll.getNotesBetween(Math.min(this._x, this._x + this._width), Math.max(this._x, this._x + this._width))) {
                if (note.pitch >= Math.min(this._y, this._y + this._height) && note.pitch <= Math.max(this._y, this._y + this._height)) {
                    selectedNotes.push(note)
                }
            }
            if (selectedNotes.length > 0) {
                emit("select-notes", selectedNotes)
            }
        }
        else {

            // select bars that touch the selection
            let startBar = Math.max(0, Math.floor(Math.min(this._x, this._x + this._width) / 4) * 4)
            let endBar = Math.min(10000, Math.ceil(Math.max(this._x, this._x + this._width) / 4) * 4)
            setSelectionBox({ x: startBar, y: minPitch - 1, width: endBar - startBar, height: maxPitch - minPitch + 1 })

            selectRange({start: startBar, end: endBar})
            emit("select-range", startBar, endBar)
        }

    }
    public mouseUp(event: MouseEvent): void {
        if (Math.abs(this._height) > 5 || Math.abs(this._width) < 3) {
            setSelectionBox(null)
        }
        
    }
}

const updatePlayerNotes = (): void => {
    if (!isPlaying.value) {
        return
    }
    const notes: any[] = []
    for (const note of pianoroll.getNotes()) {
        notes.push({ pitch: note.pitch, startTime: note.onset / bps(), endTime: (note.onset + note.duration) / bps(), velocity: note.velocity })
    }
    player.updateNotes(notes)
}


interface Style{
    drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, highlightedYs: number[], highlightedHeight:number): void
    drawNote(ctx: CanvasRenderingContext2D, note: Note, x: number, y: number, width: number, height: number, selected: boolean): void
    drawBarLine(ctx: CanvasRenderingContext2D, frame: number, x: number, height: number): void
    drawSelection(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void
}

class ChromaticStyle implements Style{
    public drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, highlightedYs: number[], highlightedHeight:number) {
        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, width, height)
        // for (const y of highlightedYs) {
        //     ctx.fillStyle = "#404040"
        //     ctx.fillRect(0, y - highlightedHeight/2, width, highlightedHeight)
        // }
    }
    public drawNote(ctx: CanvasRenderingContext2D, note: Note, x: number, y: number, width: number, height: number, selected: boolean) {
        // sustain
        const hue = (note.pitch % 12) * 30.0 / 180 * Math.PI // 30 degrees per semitone
        let lightness = Math.pow(note.velocity / 127, 2) * 128
        // lightness += Math.abs(hue - 120) * 0.4 * (90 - lightness) / 100

        if (selected) {
            lightness += 30
        }
        ctx.beginPath()
        ctx.roundRect(
            x,
            y,
            width,
            height,
            1,
        )
        const centering = Math.max(0.2, 1.1 - note.velocity/127)
        ctx.globalAlpha = selected? 0.5:0.2
        ctx.fillStyle = selected? "white":labToRgbString(lightness, Math.cos(hue)*128*centering, Math.sin(hue)*128*centering)
        ctx.fill()

        ctx.beginPath()
        // onset (square)
        let onsetHeight = height * Math.exp(note.velocity / 127 * 1.6-0.4)
        ctx.rect(
            x - height/2,
            y + height/2 - onsetHeight/2,
            height,
            onsetHeight,
        )
        ctx.globalAlpha = 1
        ctx.fillStyle = labToRgbString(lightness, Math.cos(hue)*128, Math.sin(hue)*128)
        ctx.fill()
        
    }
    public drawBarLine(ctx: CanvasRenderingContext2D, frame: number, x: number, height: number): void {
        if (frame % 4 == 0) {
            ctx.strokeStyle = "#444444"
        } else if (frame % 1 == 0) {
            ctx.strokeStyle = "#252525"
        } else {
            ctx.strokeStyle = "#151515"
        }
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.fillStyle = "#aaaaaa"

    }
    public drawSelection(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        ctx.fillStyle = "#4AA9450f"
        ctx.strokeStyle = "#45A96B"
        ctx.beginPath()
       
        ctx.roundRect(x,y,width,height,2)
        ctx.fill()
        ctx.stroke()
    }
}

class FruityStyle implements Style{
    drawSelection(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        throw new Error("Method not implemented.")
    }
    public drawBarLine(ctx: CanvasRenderingContext2D, frame: number, x: number, height: number): void {
        if (frame % 4 == 0) {
            ctx.strokeStyle = "#000000a0"
        } else if (frame % 1 == 0) {
            ctx.strokeStyle = "#00000040"
        } else {
            ctx.strokeStyle = "#00000020"
        }
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.fillStyle = "#aaaaaa"
        if (frame % 4 == 0) {
            ctx.fillText(
                (frame / 4 + 1).toString(),
                x + 5,
                15,
            )
        }
    }
    public drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = "#2E3E48"
        ctx.fillRect(0, 0, width, height)
    }
    public drawNote(ctx: CanvasRenderingContext2D, note: Note, x: number, y: number, width: number, height: number) {
        // sustain

        let lightness = Math.pow(note.velocity / 127, 2) * 50 +40 
        const gap = 1
        ctx.beginPath()
        ctx.roundRect(
            x + gap,
            y,
            width - 2*gap,
            height,
            1,
        )
        ctx.fillStyle = `hsl(90, 20%, ${lightness}%)`
        ctx.fill()
    }
}


class FruityDarkStyle implements Style{

    public drawBarLine(ctx: CanvasRenderingContext2D, frame: number, x: number, height: number): void {
        if (frame % 4 == 0) {
            ctx.strokeStyle = "#ffffff40"
        } else if (frame % 1 == 0) {
            ctx.strokeStyle = "#ffffff20"
        } else {
            ctx.strokeStyle = "#ffffff10"
        }
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.fillStyle = "#888888"
    }
    public drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.fillStyle = "#050505"
        ctx.fillRect(0, 0, width, height)
    }
    public drawNote(ctx: CanvasRenderingContext2D, note: Note, x: number, y: number, width: number, height: number, selected: boolean) {
        // sustain

        let lightness = Math.pow(note.velocity / 127, 2) * 50 +40 
        const gap = 1
        ctx.beginPath()
        ctx.roundRect(
            x + gap,
            y,
            width - 2*gap,
            height,
            1,
        )
        ctx.fillStyle = selected? `hsl(0, 25%, ${lightness}%)`:`hsl(90, 25%, ${lightness}%)`
        ctx.fill()

    }
    public drawSelection(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        ctx.fillStyle = "#4AA9450f"
        ctx.strokeStyle = "#444762"
        ctx.beginPath()
       
        ctx.roundRect(x,y,width,height,2)
        ctx.fill()
        ctx.stroke()
    }
}



let style = new FruityDarkStyle()
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


    const highlightedYs: number[] = []
    for (let i = 0; i < 11; i++) {
        for (let j of [0, 2, 4, 5, 7, 9, 11]) {
            highlightedYs.push(pitchToCanvas(i*12 + j))
        }
    }
    style.drawBackground(ctx, width, height, highlightedYs, height/numPitches)

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
    if (props.display === "simple") {
        hop = Math.max(hop, 4)
    }
    startDrawnBar = Math.max(startDrawnBar, 0)
    for (let i = startDrawnBar; i <= endDrawnBar; i += hop) {
        style.drawBarLine(ctx, i, beatToCanvas(i), height)
        if (i % 4 == 0 && props.display === "standard") {
            ctx.fillText(
                (i / 4 + 1).toString(),
                beatToCanvas(i) + 5,
                15,
            )
        }
    }

    
    if (selectionBox) {
        style.drawSelection(ctx, beatToCanvas(selectionBox.x), pitchToCanvas(selectionBox.y), beatToCanvas(selectionBox.x + selectionBox.width) - beatToCanvas(selectionBox.x), pitchToCanvas(selectionBox.y + selectionBox.height) - pitchToCanvas(selectionBox.y))
    }
    

    // Draw MIDI notes
    const timeLowerBound = Math.max(0, -shiftX)
    const timeUpperBound = width / scaleX - shiftX
    for (const note of pianoroll.getNotesBetween(
        timeLowerBound,
        timeUpperBound,
    )) {
        style.drawNote(ctx, note, (note.onset + shiftX) * scaleX,
        pitchToCanvas(note.pitch),
        note.duration * scaleX,
        height / numPitches,
        selectedNotes.includes(note),
        )
    }

    // Draw cursor
    if (props.interactive || isPlaying.value) {
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
    }

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
    duration: number|null = null,
    snap = 0.125,
): Note => {
    onset = Math.round(onset / snap) * snap
    if (onset < 0) {
        onset = 0
    }
    const notesInBar = pianoroll.getNotesOnsetBetween(
        onset,
        onset - (onset % 4) + 4,
    )
    let duration_ = duration ?? (-onset % 4) + 4
    for (const note of notesInBar) {
        if (note.pitch === pitch) {
            duration = Math.min(duration_, note.onset - onset)
        }
    }
    duration = Math.max(Math.round(duration_ / snap) * snap, snap)
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
        ((numPitches - pitch + minPitch - 1) / numPitches) *
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
        minPitch -
        1
    return Math.max(Math.min(pitch, maxPitch), minPitch)
}

const handleWheel = (event: WheelEvent): void => {
    if (!props.interactive) {
        return
    }
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
        shiftX -= (1 * (event.deltaY+event.deltaX)) / scaleX
        shiftX = Math.min(shiftX, 100 / scaleX)
    }
    render()
}

const handleMouseDown = (event: MouseEvent): void => {
    // test if mouse on cursor
    if (!props.interactive) {
        return
    }
    const cursorX = getCursorCanvasPosition()
    const pointerX = screenToCanvas(event.clientX)
    if (event.ctrlKey) {
        dragBehavior = new SelectionDragBehavior()
    } else if (event.buttons === 1) {
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
    for (const note of pianoroll.getNotes()) {
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
    player.timeVersion++
    const startTime = Date.now()
    let duration = sequence.notes.length > 0 ? sequence.notes[sequence.notes.length - 1].endTime : 0 
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

        let endTime = duration * bps()
        if (selectedRange) {
            endTime = selectedRange.end
        }
        if (player.time! * bps() > endTime) {
            stop()
            if (selectedRange) {
                cursorPosition = selectedRange.start
            }
            render()
        }
    }, 20)
}

const _stop = (): void => {
    if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
    }
    if (playbackId === player.playbackId) {
        player.stop()
    }
    isPlaying.value = false
    if (!props.interactive) {
        // reset cursor position because the user can't move it
        cursorPosition = 0
        render()
    }
}

const play = (): void => {
    if (!isPlaying.value) {
        _play()
    }
}

const stop = (): void => {
    if (isPlaying.value) {
        _stop()
    }
}


const keepCursorInScreen = (): void => {
    // update shiftX to keep cursor in screen
    if (!props.interactive) {
        return
    }
    const margin = Math.min(pianorollCanvas.value!.clientWidth * 0.2, 200)
    const targetCursorX = Math.min(Math.max(margin*0.2, getCursorCanvasPosition()), pianorollCanvas.value!.clientWidth - margin)
    shiftX += (targetCursorX - getCursorCanvasPosition()) / scaleX
}

const getMidi = (): File => {
    const outputBuffer = pianoroll.toMidi().toArray()
    const blob = new Blob([outputBuffer], { type: "audio/midi" })
    return new File([blob], "generated.mid", { type: "audio/midi", lastModified: Date.now() })
}


const loadMidiFile = async (midiFile: File | Blob): Promise<void> => {
    const arrayBuffer = await midiFile.arrayBuffer()
    pianoroll = new Pianoroll(arrayBuffer)
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
    pianoroll = new Pianoroll()
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



function transform(transform: { scaleX: number, shiftX: number }, notify: boolean = true) {
    scaleX = transform.scaleX
    shiftX = transform.shiftX
    render(notify)
}

function setBps(newBps: number|null) {
    overrideBps = newBps
    updatePlayerNotes()
}

function selectRange(range: { start: number, end: number }) {
    setSelectionBox({ x: range.start, y: minPitch - 1, width: range.end - range.start, height: maxPitch - minPitch + 1 })
    selectedNotes = pianoroll.getNotesBetween(range.start, range.end, false)
    selectedRange = { start: range.start, end: range.end }
    if (!isPlaying.value) {
        cursorPosition = range.start
    }
    render()
}

const getPianoroll = (): Pianoroll => {
    return pianoroll
}

const handleDelete = (e: KeyboardEvent) => {
    for (const note of selectedNotes) {
        pianoroll.removeNote(note)
    }
    emit("edit", [], selectedNotes)
    render()
    
}

//expose loadMidiFile to parent
defineExpose({
    loadMidiFile,
    transform,
    setBps,
    getSelectionBox,
    setSelectionBox,
    getMidi,
    selectRange,
    playOrStop,
    play,
    stop,
    getPianoroll,
    screenToBeat,
    screenToPitch,
    render,
    updatePlayerNotes,
    handleDelete
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
