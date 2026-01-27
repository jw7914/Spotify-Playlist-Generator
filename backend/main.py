from fastapi import FastAPI, APIRouter
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from backend.routers import spotify, gemini

# --- App Initialization ---
app = FastAPI(title="Spotify Playlist Generator")

# --- API Router ---
api_router = APIRouter(prefix="/api")
api_router.include_router(spotify.router, prefix="/spotify")
api_router.include_router(gemini.router, prefix="/gemini")
app.include_router(api_router)

# --- Debug Route ---
@app.get("/api/routes")
def list_routes():
    return [r.path for r in app.router.routes]

# --- Static Files & Frontend ---
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = (BASE_DIR.parent / "frontend" / "dist").resolve()
app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIST / "assets"),
    name="assets"
)

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = FRONTEND_DIST / "index.html"
    file_path = FRONTEND_DIST / full_path

    if file_path.exists() and not file_path.is_dir():
        return FileResponse(file_path)

    if not index_path.exists():
        return {"error": "Frontend not found. Did you run 'npm run build'?"}
    
    return FileResponse(index_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)