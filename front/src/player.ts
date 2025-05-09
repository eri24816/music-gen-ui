import * as mm from '@magenta/music';
import { ref, type Ref } from 'vue';
export const playerState: {time: number | null, timeVersion: number, isReady: Ref<boolean>} = {
    time: null,
    timeVersion: 0,
    isReady: ref(false)
}

class PlayerCallback extends mm.BasePlayerCallback {
    run(note: mm.NoteSequence.INote) {
        playerState.time = note.startTime!;
        playerState.timeVersion++;
    }
    stop() {
        playerState.time = null;
        playerState.timeVersion++;
    }
}

const callback = new PlayerCallback();

export const player = new mm.SoundFontPlayer(
    'https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus',
    undefined,
    undefined,
    undefined,
    callback
);

player.loadAllSamples().then(() => {
    playerState.isReady.value = true;
});

export function playNote(pitch: number, velocity: number) {
    const sequence: mm.NoteSequence = {
        notes: [{ pitch: 60, startTime: 0, endTime: 1, program: 0 },
            { pitch: 64, startTime: 1, endTime: 2, program: 0 },
            { pitch: 60, startTime: 2, endTime: 3, program: 0 },
            { pitch: 60, startTime: 3, endTime: 4, program: 0 },
            { pitch: 60, startTime: 4, endTime: 5, program: 0 },
            { pitch: 60, startTime: 5, endTime: 6, program: 0 },
            { pitch: 60, startTime: 6, endTime: 7, program: 0 },
            
        ],
        
        totalTime: 8
    };
    
    player.start(sequence, undefined, 1);
}
