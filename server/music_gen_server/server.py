import json
from typing import AsyncGenerator
from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
import miditoolkit.midi.parser
from music_data_analysis import Note
from pydantic import BaseModel
import uvicorn

class RangeToGenerate(BaseModel):
    start_beat: int
    end_beat: int

class SegmentInfo(BaseModel):
    start_bar: int
    end_bar: int
    label: str

class GenerateParams(BaseModel):
    range_to_generate: RangeToGenerate
    segments: list[SegmentInfo]
    song_duration: int

class MusicGenServer:
    def __init__(self, frontend_dir: str='ui/dist'):
        self._app = FastAPI()
        self._frontend_dir = frontend_dir
        self._setup_routes()
    
    def get_app(self) -> FastAPI:
        """Get the FastAPI application instance"""
        return self._app
    
    def run(self, host: str='127.0.0.1', port: int=8000):
        """Run the server with uvicorn"""
        uvicorn.run(self._app, host=host, port=port)
    
    def _setup_routes(self):
        """Setup the routes for the server"""
        self._app.get("/{path:path}")(self.read_file)
        self._app.post("/api/generate/")(self._generate)

    # routes
    
    def read_file(self, path: str):
        """Regular file serving"""
        return FileResponse(path=f'{self._frontend_dir}/{path}')
    
    async def _generate(self, midi_file: UploadFile, params: str= Form()):
        params_obj = GenerateParams.model_validate_json(params)
        midi = miditoolkit.midi.parser.MidiFile(file=midi_file.file)
        return StreamingResponse(self._generate_stream(midi, params_obj), media_type="audio/midi")
    
    async def _generate_stream(self, midi: miditoolkit.midi.parser.MidiFile, params: GenerateParams) -> AsyncGenerator[bytes, None]:
        async for onset, pitch, velocity, offset in self.generate(midi, params):
            yield (json.dumps([onset, pitch, velocity, offset]) + "\n").encode('utf-8')

    # abstract methods
    async def generate(self, midi: miditoolkit.midi.parser.MidiFile, params: GenerateParams) -> AsyncGenerator[Note, None]:
        raise NotImplementedError("Not implemented")
    