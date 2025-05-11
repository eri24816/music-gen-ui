import { ref, type Ref } from 'vue';
import { Piano } from '@tonejs/piano';
import * as Tone from 'tone';

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
    /**
     * Creates an instance of AutoKeyupPiano.
     * @param {Piano} piano - The Piano instance to be wrapped.
     */
    constructor(public piano: Piano) {
        this.piano = piano;
    }

    /**
     * Plays a note and schedules its key-up event.
     */
    playNote(onset: number, pitch: number, velocity: number, offset: number) {
        if (this.pendingOffsets.has(pitch)) {
            this.piano.keyUp({ midi: pitch, time: offset });
        }
        this.piano.keyDown({ midi: pitch, velocity: velocity/127, time: onset });
        this.pendingOffsets.set(pitch, offset);
    }

    playNoteImmediate(pitch: number, velocity: number, duration: number) {
        if (this.pendingOffsets.has(pitch)) {
            this.piano.keyUp({ midi: pitch });
        }
        console.log("playing note", pitch, velocity, duration)
        this.piano.keyDown({ midi: pitch, velocity: velocity/127 });
        this.pendingOffsets.set(pitch, this.now + duration);
    }

    /**
     * Stops a note immediately.
     * @param {INote} note - The note to be stopped.
     */
    stopNote(note: INote) {
        this.piano.keyUp({ midi: note.pitch });
        this.pendingOffsets.delete(note.pitch);
    }

    /**
     * Updates the piano state, releasing keys that have reached their offset time.
     * @param {number} time - The current time.
     */
    update(time: number) {
        for (const [pitch, offset] of this.pendingOffsets.entries()) {
            if (time > offset) {
                this.piano.keyUp({ midi: pitch });
                this.pendingOffsets.delete(pitch);
            }
        }
        this.now = time;
    }

    /**
     * Stops all currently playing notes.
     */
    stop() {
        for (const [pitch, offset] of this.pendingOffsets.entries()) {
            this.piano.keyUp({ midi: pitch });
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

        const gain = new Tone.Gain(0.3).toDestination();
        tonePiano.disconnect();
        tonePiano.chain(gain);

        tonePiano.load().then(() => {
            console.log("Piano loaded");
            this.isReady.value = true;
        });
        this.piano = new AutoKeyupPiano(tonePiano);
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

    start(sequence: { notes: INote[] },  startTime: number = 0, noteOnCallback: (note: INote) => void = () => {}) {
        this.notes = sequence.notes;
        this.startOffset = startTime;
        this.playing = true;
        this.playbackId++;

        
        const currentId = this.playbackId;
        const startTimeStamp = performance.now();
        

        // sort notes by start time
        this.notes.sort((a, b) => a.startTime - b.startTime);
        const duration = this.notes[this.notes.length - 1].endTime

        let currentNoteIdx = 0
        for (; currentNoteIdx < this.notes.length; currentNoteIdx++) {
            if (this.notes[currentNoteIdx].startTime >= startTime) {
                break;
            }
        }

        const tick = () => {
            if (currentId !== this.playbackId) return;
            
            const currentTime = (performance.now() - startTimeStamp) / 1000 + this.startOffset;
            this.time = currentTime;
            this.timeVersion++;


            this.piano.update(currentTime);

            for (; currentNoteIdx < this.notes.length; currentNoteIdx++) {
                const note = this.notes[currentNoteIdx];
                if (currentTime >= note.startTime) {
                    this.piano.playNoteImmediate(note.pitch, note.velocity, note.endTime - note.startTime);
                    noteOnCallback(note);
                } else {
                    break;
                }
            }

            if (currentTime > duration) {
                this.stop();
                return;
            }

            setTimeout(tick, 15);
        };

        setTimeout(tick, 15);
        return this.playbackId
    }

    stop() {
        this.playing = false;
        this.playbackId++;
        this.time = null;
        this.timeVersion++;
        this.piano?.stop();
    }
}

export const player = new Player();