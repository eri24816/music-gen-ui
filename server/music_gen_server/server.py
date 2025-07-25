import asyncio
import json
from typing import AsyncGenerator
from fastapi import FastAPI, Form, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
import miditoolkit.midi.parser
from pydantic import BaseModel
import uvicorn

class RangeToGenerate(BaseModel):
    start_beat: int
    end_beat: int

class SegmentInfo(BaseModel):
    start_bar: int
    end_bar: int
    label: str
    is_seed: bool

class GenerateParams(BaseModel):
    range_to_generate: RangeToGenerate
    segments: list[SegmentInfo]
    song_duration: int
class MusicGenServer:
    def __init__(self, frontend_dir: str='ui/dist'):
        self._app = FastAPI()
        self._frontend_dir = frontend_dir
        self._setup_routes()
        self.cancel_events = {}
    
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
    
    async def _generate(self, midi_file: UploadFile, params: str= Form(), client_id: str= Form()):
        print(f"client_id: {client_id}")
        params_obj = GenerateParams.model_validate_json(params)
        midi = miditoolkit.midi.parser.MidiFile(file=midi_file.file)
        return StreamingResponse(self._generate_stream(midi, params_obj, client_id), media_type="audio/midi")
    
    async def _generate_stream(self, midi: miditoolkit.midi.parser.MidiFile, params: GenerateParams, client_id: str) -> AsyncGenerator[bytes, None]:
        print(f"client_id: {client_id}")
        if client_id in self.cancel_events:
            print(f"cancelling generation for client_id: {client_id}")
            self.cancel_events[client_id].set()
            self.cancel_events.pop(client_id)
        cancel_event = self.cancel_events[client_id] = asyncio.Event()
        iterable: AsyncGenerator[tuple[float, int, int, float], None] = self.generate(midi, params, cancel_event) # type: ignore , typing does not recognize the async generator
        async for onset, pitch, velocity, duration in iterable:
            yield (json.dumps([onset, pitch, velocity, duration]) + "\n").encode('utf-8')
        if cancel_event in self.cancel_events:  
            self.cancel_events.pop(client_id)

    # abstract methods
    async def generate(self, midi: miditoolkit.midi.parser.MidiFile, params: GenerateParams, cancel_event: asyncio.Event) -> AsyncGenerator[tuple[float, int, int, float], None]:
        raise NotImplementedError("Not implemented")
