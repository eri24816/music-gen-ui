import { ref, watch, type Ref } from 'vue';
import { Piano } from '@tonejs/piano';
import * as Tone from 'tone';
import { useStore } from './stores/store'

export interface INote {
    pitch: number
    startTime: number
    endTime: number
    velocity: number
}

export class AutoKeyupPiano {
    /** Map to store pending note offsets (pitch -> offset) */
    private pendingOffsets: Map<number, number> = new Map();
    private now: number = 0

    store = useStore()
    /**
     * Creates an instance of AutoKeyupPiano.
     * @param {Piano} piano - The Piano instance to be wrapped.
     */
    constructor(public piano: Piano) {
        this.piano = piano;
    }

    keyUp(pitch: number) {
        if (this.store.useMidiOut) {
            this.store.midiPort?.send([0x80, pitch, 0]);
        } else {
            this.piano.keyUp({ midi: pitch });
        }
    }

    keyDown(pitch: number, velocity: number) {
        if (this.store.useMidiOut) {
            this.store.midiPort?.send([0x90, pitch, velocity]);
        } else {
            this.piano.keyDown({ midi: pitch, velocity: velocity/127 });
        }
    }
    /**
     * Plays a note and schedules its key-up event.
     */
    playNote(onset: number, pitch: number, velocity: number, offset: number) {
        if (this.pendingOffsets.has(pitch)) {
            this.keyUp(pitch);
        }
        this.keyDown(pitch, velocity);
        this.pendingOffsets.set(pitch, offset);
    }

    playNoteImmediate(pitch: number, velocity: number, duration: number) {
        if (this.pendingOffsets.has(pitch)) {
            this.keyUp(pitch);
        }
        this.keyDown(pitch, velocity);
        this.pendingOffsets.set(pitch, this.now + duration);
    }

    /**
     * Stops a note immediately.
     * @param {INote} note - The note to be stopped.
     */
    stopNote(note: INote) {
        this.keyUp(note.pitch);
        this.pendingOffsets.delete(note.pitch);
    }

    /**
     * Updates the piano state, releasing keys that have reached their offset time.
     * @param {number} time - The current time.
     */
    update(time: number) {
        for (const [pitch, offset] of this.pendingOffsets.entries()) {
            if (time > offset) {
                this.keyUp(pitch);
                this.pendingOffsets.delete(pitch);
            }
        }
        this.now = time;
    }

    /**
     * Stops all currently playing notes.
     */
    stop(allowSustain: boolean = false) {
        for (const [pitch, offset] of this.pendingOffsets.entries()) {
            if (allowSustain) {
                this.keyUp(pitch);
            } else {
                this.keyUp(pitch);
            }

            this.pendingOffsets.delete(pitch);
        }
    }
}

export class Player {
    private piano: AutoKeyupPiano
    public time: number | null = null
    public timeVersion: number = 0
    public isReady: Ref<boolean> = ref(false)
    public playbackId: number = 0
    private notes: INote[] = []
    private playing: boolean = false
    private startOffset: number = 0
    private gain: Tone.Gain

    constructor() {
        const tonePiano = new Piano({
            velocities: 5,
            volume: {
                pedal: 0,
                strings: 0,
                keybed: 0,
                harmonics: 0,
            }
        })

        this.gain = new Tone.Gain(0.3).toDestination();
        tonePiano.disconnect();
        tonePiano.chain(this.gain);

        tonePiano.load().then(() => {
            console.log("Piano loaded");
            this.isReady.value = true;
        });
        this.piano = new AutoKeyupPiano(tonePiano);
    }

    setVolume(volume: number) {
        this.gain.gain.value = volume;
    }
    
    isPlaying() {
        return this.playing;
    }

    playNoteDown(note: INote) {
        if (!this.piano) return;
        this.piano.playNoteImmediate(note.pitch, note.velocity, note.endTime - note.startTime);
    }

    playNoteUp(note: INote) {
        if (!this.piano) return;
        this.piano.stop();
    }

    private currentNoteIdx = 0
    private currentTime = 0

    updateNotes(notes: INote[]) {
        this.notes = notes;
        
        // sort notes by start time
        this.notes.sort((a, b) => a.startTime - b.startTime);

        for (this.currentNoteIdx = 0; this.currentNoteIdx < this.notes.length; this.currentNoteIdx++) {
            if (this.notes[this.currentNoteIdx].startTime >= this.currentTime) {
                break;
            }
        }
    }

    start(sequence: { notes: INote[] },  startTime: number = 0, noteOnCallback: (note: INote) => void = () => {}) {
        this.startOffset = startTime;
        this.playing = true;
        this.playbackId++;
        
        const currentId = this.playbackId;
        const startTimeStamp = performance.now();
        
        this.currentTime = startTime - 0.01;
        this.updateNotes(sequence.notes);

        const tick = () => {
            if (currentId !== this.playbackId) return;
            
            this.currentTime = (performance.now() - startTimeStamp) / 1000 + this.startOffset;
            this.time = this.currentTime;
            this.timeVersion++;


            this.piano.update(this.currentTime);
            for (; this.currentNoteIdx < this.notes.length; this.currentNoteIdx++) {
                const note = this.notes[this.currentNoteIdx];
                if (this.currentTime >= note.startTime) {
                    this.piano.playNoteImmediate(note.pitch, note.velocity, note.endTime - note.startTime);
                    noteOnCallback(note);
                } else {
                    break;
                }
            }

            // if (currentTime > duration) {
            //     this.stop();
            //     return;
            // }

            setTimeout(tick, 15);
        };

        setTimeout(tick, 15);
        return this.playbackId
    }

    stop(allowSustain: boolean = false) {
        this.playing = false;
        this.playbackId++;
        this.time = null;
        this.timeVersion++;
        this.piano?.stop(allowSustain);
    }
}

let player: Player | null = null
export const getPlayer = () => {
    if (!player) {
        player = new Player();
    }
    return player;
}