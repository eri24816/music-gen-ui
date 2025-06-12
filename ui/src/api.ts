import axios from 'axios';

type RangeToGenerate = {
  start_beat: number;
  end_beat: number;
};

type SegmentInfo = {
  start_bar: number;
  end_bar: number;
  label: string;
};

type GenerateParams = {
  range_to_generate: RangeToGenerate;
  segments: SegmentInfo[];
  song_duration: number;
}

/**
 * Generates a new MIDI file from an existing one.
 * @param midiFile - The MIDI file to transform
 * @returns Promise containing the generated MIDI file as a Blob
 */
export async function generate(midi: Blob, params: any): Promise<Response> {
  const formData = new FormData();
  formData.append('midi_file', midi);
  formData.append('params', JSON.stringify(params));
  
  return fetch('/api/generate/', {
    method: 'POST',
    body: formData
  });
}
