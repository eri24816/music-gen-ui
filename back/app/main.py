import os
from fastapi import FastAPI
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

# Add a test API endpoint
@app.get("/test")
async def test():
    return {"message": "This is a message from backend"}

@app.get("/resource/{path:path}")
async def get_resource(path: str):
    return FileResponse(f"resource/{path}")
@app.get("/resource_ls")
async def get_resource_ls_root():
    # return os.listdir("resource")
    entries = os.listdir("resource")
    files = []
    dirs = []
    for entry in entries:
        if os.path.isdir(f"resource/{entry}"):
            dirs.append(entry)
        else:
            files.append(entry)
    return {
        "files": files,
        "dirs": dirs
    }

@app.get("/resource_ls/{path:path}")
async def get_resource_ls(path: str):
    # list all files in the directory
    entries = os.listdir(f"resource/{path}")
    files = []
    dirs = []
    for entry in entries:
        if os.path.isdir(f"resource/{path}/{entry}"):
            dirs.append(entry)
        else:
            files.append(entry)
    return {
        "files": files, 
        "dirs": dirs
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
