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
export async function generate(midiFile: File, params: GenerateParams): Promise<Blob> {
  const formData = new FormData();
  formData.append('midi_file', midiFile);
  formData.append('params', JSON.stringify(params));
  
  try {
    const response = await axios.post('/api/generate/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    });

    return response.data;
  } catch (error) {
    console.error('Error generating music:', error);
    throw error;
  }
}
