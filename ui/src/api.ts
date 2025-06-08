import axios from 'axios';

type GenerateParams = {
  rangeToGenerate: {start: number, end: number};
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
