
import { Buffer } from "buffer";
import { now } from "tone";
import { Midi } from "@tonejs/midi/src/Midi";
export function base64Encode(array: Uint8Array): string {
    return Buffer.from(array).toString("base64");
}

export function base64Decode(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, "base64"));
}

export function getBps(midi: Midi): number {
    if (midi.header.tempos.length > 0) {
        return midi.header.tempos[0].bpm / 60;
    } else {
        return 120 / 60;
    }
}

export class Note {
    onset: number;
    duration: number;
    pitch: number;
    velocity: number;

    constructor(
        onset: number,
        duration: number,
        pitch: number,
        velocity: number,
    ) {
        this.onset = onset;
        this.duration = duration;
        this.pitch = pitch;
        this.velocity = velocity;
    }

    equals(note: Note): boolean {
        return (
            this.onset === note.onset &&
            this.duration === note.duration &&
            this.pitch === note.pitch &&
            this.velocity === note.velocity
        );
    }
}

/**
 * A simpler subset of Midi data.
 * Only contains onsets of notes and their duration, pitch, and velocity.
 */
export class Pianoroll {
    private notes: Note[];
    bps: number;
    private midiData: ArrayBuffer | null = null;
    private _duration: number = 0;
    get duration(): number {
        return this._duration;
    }

    constructor(midiData: ArrayBuffer | Uint8Array | null = null) {
        if (!midiData) {
            this.notes = [];
            this.bps = 120 / 60;
            return;
        }
        this.midiData = midiData;

        const midi = new Midi(midiData);
        this.bps = getBps(midi);
        this.notes = midi.tracks[0].notes.map(
            (note) =>
                new Note(
                    note.time * this.bps,
                    note.duration * this.bps,
                    note.midi,
                    note.velocity*127,
                ),
        );
        this.recalculateDuration();
    }

    toMidi(): Midi {
        const midi = new Midi();
        midi.addTrack();
        if (this.midiData) {
            const oldMidi = new Midi(this.midiData);
            midi.header = oldMidi.header;
        }
        midi.header.update();
        const ticksPerSecond = midi.header.secondsToTicks(1);
        this.bps = getBps(midi);

        for (const note of this.notes) {
            // Do not use time/duration in the addNote function. It incorrectly calculates the ticks.
            midi.tracks[0].addNote({
                ticks: (note.onset / this.bps) * ticksPerSecond,
                durationTicks: (note.duration / this.bps) * ticksPerSecond,
                midi: note.pitch,
                velocity: note.velocity,
            });
        }
        return midi;
    }

    getNotes(): Note[] {
        return this.notes;
    }

    /**
     * Get notes that overlap with a time interval.
     * @param {number} start - The start beat.
     * @param {number} end - The end beat.
     * @returns {Note[]} An array of notes that are between the start and end beats.
     */
    getNotesBetween(start: number, end: number): Note[] {
        return this.notes.filter(
            (note) => note.onset < end && note.onset + note.duration >= start,
        );
    }

    getNoteAt(beat: number, pitch: number): Note | null {
        const tmp =
            this.notes.find(
                (note) =>
                    note.onset < beat &&
                    note.onset + note.duration > beat &&
                    note.pitch === pitch,
            ) || null;
        if (tmp) {
            return tmp;
        } else {
            return null;
        }
    }

    /**
     * Get notes that start between two beats.
     * @param {number} start - The start beat.
     * @param {number} end - The end beat.
     * @returns {Note[]} An array of notes that start between the start and end beats.
     */
    getNotesOnsetBetween(start: number, end: number): Note[] {
        return this.notes.filter(
            (note) => note.onset < end && note.onset >= start,
        );
    }

    addNote(note: Note) {
        this.notes.push(note);
        this._duration = Math.max(this._duration, note.onset + note.duration);
    }

    removeNote(note: Note) {
        this.notes = this.notes.filter((n) => !n.equals(note));
        this.recalculateDuration();
    }

    overlapWith(other: Pianoroll, shift: number = 0): void {
        for (const note of other.notes) {
            this.addNote(
                new Note(
                    note.onset + shift,
                    note.duration,
                    note.pitch,
                    note.velocity,
                ),
            );
        }
    }

    slice(start: number, end: number, shift = false): Pianoroll {
        start -= 0.001;
        end -= 0.001;
        const sliced = new Pianoroll();
        sliced.notes = this.notes.filter(
            (note) => note.onset >= start && note.onset <= end,
        );
        // clone the notes
        sliced.notes = sliced.notes.map((note) => {
            return new Note(
                shift ? note.onset - start : note.onset,
                note.duration,
                note.pitch,
                note.velocity,
            );
        });

        sliced.recalculateDuration();
        return sliced;
    }

    removeSlice(start: number, end: number): void {
        start -= 0.001;
        end -= 0.001;
        this.notes = this.notes.filter(
            (note) => note.onset <= start || note.onset >= end,
        );
        this.recalculateDuration();
    }

    recalculateDuration(): void {
        if (this.notes.length === 0) {
            this._duration = 0;
        } else
            this._duration = Math.max(
                ...this.notes.map((note) => note.onset + note.duration),
            );
    }
}



export class CooldownDict {
    private cooldowns: { [key: string]: Cooldown } = {};

    constructor(private cooldownTime: number) {}

    request(key: string, cb: () => void) {
        if (!this.cooldowns[key]) {
            this.cooldowns[key] = new Cooldown(this.cooldownTime);
        }
        this.cooldowns[key].request(cb);
    }
}

export class Cooldown {
    // when request() is called, run the function when at least cooldown time has passed since the last call
    constructor(private cooldownTime: number) {}
    private lastCallTime: number = 0;
    private lastCallCb: () => void = () => {};
    private timeout: NodeJS.Timeout | null = null;

    request(cb: () => void) {
        const nowTime = Date.now() / 1000;
        if (nowTime - this.lastCallTime > this.cooldownTime) {
            this.lastCallTime = nowTime;
            cb();
        } else {
            this.lastCallCb = cb;
            if (this.timeout) {
                return;
            }
            this.timeout = setTimeout(
                () => {
                    this.lastCallTime = Date.now() / 1000;
                    this.lastCallCb();
                    this.timeout = null;
                },
                (this.cooldownTime - (nowTime - this.lastCallTime)) * 1000,
            );
        }
    }
}

function labToXyz(l: number, a: number, b: number) {
  const y = (l + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const [xr, yr, zr] = [x, y, z].map(v => {
    const v3 = v ** 3;
    return v3 > 0.008856 ? v3 : (v - 16 / 116) / 7.787;
  });

  // D65 reference white
  return {
    x: xr * 95.047,
    y: yr * 100.0,
    z: zr * 108.883
  };
}

function xyzToRgb(x: number, y: number, z: number) {
  x /= 100;
  y /= 100;
  z /= 100;

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * -0.2040 + z * 1.0570;

  const compand = c => {
    return c > 0.0031308
      ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055
      : 12.92 * c;
  };

  r = compand(r);
  g = compand(g);
  b = compand(b);

  return {
    r: Math.min(255, Math.max(0, r * 255)),
    g: Math.min(255, Math.max(0, g * 255)),
    b: Math.min(255, Math.max(0, b * 255))
  };
}

function labToRgb(l: number, a: number, b: number) {
    const xyz = labToXyz(l, a, b);
    return xyzToRgb(xyz.x, xyz.y, xyz.z);
}

export function labToRgbString(l: number, a: number, b: number) {
    const rgb = labToRgb(l, a, b);
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}