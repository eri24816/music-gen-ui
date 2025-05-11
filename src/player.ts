import * as mm from '@magenta/music';
import { ref, type Ref } from 'vue';
export const playerState: {time: number | null, timeVersion: number, isReady: Ref<boolean>, playbackId: number} = {
    time: null,
    timeVersion: 0,
    isReady: ref(false),
    playbackId: -1
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

player.loadAllSamples(0).then(() => {
    playerState.isReady.value = true;
});