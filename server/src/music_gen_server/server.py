from fastapi import FastAPI, UploadFile, File, Body
from fastapi.responses import FileResponse
import miditoolkit.midi.parser
from pydantic import BaseModel
import uvicorn

class RangeToGenerate(BaseModel):
    start: int
    end: int

class GenerateParams(BaseModel):
    range_to_generate: RangeToGenerate

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
    
    def _generate(self, midi_file: UploadFile = File(...), params: GenerateParams = Body(...)):
        midi = miditoolkit.midi.parser.MidiFile(file=midi_file.file)
        return self.generate(midi, params)

    # abstract methods
    def generate(self, midi: miditoolkit.midi.parser.MidiFile, params: GenerateParams) -> miditoolkit.midi.parser.MidiFile:
        raise NotImplementedError("Not implemented")
    