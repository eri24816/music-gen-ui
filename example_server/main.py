from typing import cast
from music_data_analysis import Pianoroll
from music_gen_server import MusicGenServer, GenerateParams
import safetensors.torch
import miditoolkit.midi.parser
from segment_full_song import SegmentFullSongModel, create_model

class SegmentFullSongMusicGenServer(MusicGenServer):
    def __init__(self, device="cuda"):
        super().__init__()
        print('creating model')
        self.model = cast(SegmentFullSongModel,create_model('segment_full_song.yaml'))
        print('loading model')
        self.model.load_state_dict(safetensors.torch.load_file('epoch=41-step=250000.safetensors'))
        self.model.eval()
        self.model.to(device)
        print('model loaded')

    def generate(self, midi: miditoolkit.midi.parser.MidiFile, params: GenerateParams) -> miditoolkit.midi.parser.MidiFile:
        frames_per_beat = 8
        beats_per_bar = 4
        pr = Pianoroll.from_midi(midi, frames_per_beat=frames_per_beat, beats_per_bar=beats_per_bar)
        pr.duration=params.song_duration

        segments = []
        for segment in params.segments:
            segments.append({
                "start_bar": segment.start_bar,
                "end_bar": segment.end_bar,
                "label": segment.label,
            })
        generated_segment = self.model.generate(segments, pr, target_start_bar=params.range_to_generate.start_beat // beats_per_bar, target_end_bar=params.range_to_generate.end_beat // beats_per_bar)

        midi = generated_segment.to_midi()
        return midi
 
server = SegmentFullSongMusicGenServer()
app = server.get_app()


if __name__ == "__main__":
    server.run()

# usage: either one of
# python main.py
# uvicorn main:app