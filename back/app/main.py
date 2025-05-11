import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RESOURCE_PATH = Path(r"W:\piano-ai\VQPiano\ignore\wandb\run-20250511_165550-19mpp7eq\files").resolve()

def make_sure_path_in_root(root_path: Path, path: str):
    full_path = (root_path / path).resolve()
    
    # Make sure the file is within BASE_DIR (prevents traversal)
    if not str(full_path).startswith(str(root_path)):
        raise HTTPException(status_code=404, detail="File not found or access denied")
    
    return full_path


# Add a test API endpoint
@app.get("/api/test")
async def test():
    return {"message": "This is a message from backend"}

@app.get("/api/resource/{path:path}")
async def get_resource(path: str):
    resolved_path = make_sure_path_in_root(RESOURCE_PATH, path)
    return FileResponse(resolved_path)

@app.get("/api/resource_ls")
async def get_resource_ls_root():
    # return os.listdir("resource")
    entries = os.listdir(RESOURCE_PATH)
    files = []
    dirs = []
    for entry in entries:
        if os.path.isdir(f"{RESOURCE_PATH}/{entry}"):
            dirs.append(entry)
        else:
            files.append(entry)
    return {
        "files": files,
        "dirs": dirs
    }

@app.get("/api/resource_ls/{path:path}")
async def get_resource_ls(path: str):
    resolved_path = make_sure_path_in_root(RESOURCE_PATH, path)
    # list all files in the directory
    entries = os.listdir(resolved_path)
    files = []
    dirs = []
    for entry in entries:
        if os.path.isdir(f"{resolved_path}/{entry}"):
            dirs.append(entry)
        else:
            files.append(entry)
    return {
        "files": files, 
        "dirs": dirs
    }

@app.get("/{path:path}")
async def get_path(path: str):
    resolved_path = make_sure_path_in_root(Path(__file__).parent.parent.parent/'dist', path)
    if resolved_path == Path(__file__).parent.parent.parent/'dist':
        return FileResponse(resolved_path/'index.html')
    return FileResponse(resolved_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
