from pathlib import Path
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import RedirectResponse, FileResponse
import urllib.parse
import urllib.request
import urllib.error
import json
import base64
from dotenv import load_dotenv
import os
from datetime import datetime

# --- Configuration ---
API_BASE_URL = "https://api.spotify.com/v1"

FRONTEND_DIST = (Path(__file__).parent.parent / "frontend" / "dist").resolve()
load_dotenv()

app = FastAPI(title="Spotify Playlist Generator")
api_router = APIRouter(prefix="/api")


# --- API Routes ---
@api_router.get("/auth/login")
def login():
    scope = "user-read-private user-read-email user-top-read"
    params = {
        "client_id": os.getenv("SPOTIFY_CLIENT_ID"),
        "response_type": "code",
        "scope": scope,
        "redirect_uri": os.getenv("REDIRECT_URI") or "http://127.0.0.1:8000/api/auth/callback",
        "show_dialog": True
    }
    auth_url = f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)

@app.get("/callback")
def callback(code: str | None = None, error: str | None = None):
    if error:
        raise HTTPException(status_code=400, detail={"error": error})
    if not code:
        raise HTTPException(status_code=400, detail="Missing 'code' in callback query")

    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Missing Spotify client credentials on server")

    token_url = "https://accounts.spotify.com/api/token"
    redirect_uri = os.getenv("REDIRECT_URI") or "http://127.0.0.1:8000/api/auth/callback"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    auth_value = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_value}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    encoded = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(token_url, data=encoded, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            body_text = resp.read().decode("utf-8")
    except urllib.error.HTTPError as he:
        body = he.read().decode("utf-8") if hasattr(he, "read") else ""
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {he.code} {body}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Token exchange failed: {e}")

    if status < 200 or status >= 300:
        raise HTTPException(status_code=502, detail=f"Token endpoint returned {status}: {body_text}")

    try:
        token_data = json.loads(body_text)
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to parse token response")

    app.state.access_token = token_data["access_token"]
    app.state.refresh_token = token_data["refresh_token"]
    app.state.expires_at= datetime.now().timestamp() + token_data["expires_in"]
    return RedirectResponse(url="/playlists")

@api_router.get("/playlists")
def get_playlists():
    if not getattr(app.state, "access_token", None):
        return RedirectResponse(url="/api/auth/login")
    
    print(datetime.now().timestamp())
    if datetime.now().timestamp() > app.state.expires_at:
        return RedirectResponse("/api/auth/login") #change to refresh token later
    
    headers = {
        "Authorization": f"Bearer {app.state.access_token}"
    }
    items = []
    url = f"{API_BASE_URL}/me/playlists"
    while url:
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.getcode()
                body_text = resp.read().decode("utf-8")
        except urllib.error.HTTPError as he:
            body = he.read().decode("utf-8") if hasattr(he, "read") else ""
            if he.code == 401:
                return RedirectResponse(url="/api/auth/login")
            raise HTTPException(status_code=502, detail=f"Spotify API request failed: {he.code} {body}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Spotify API request failed: {e}")

        if status < 200 or status >= 300:
            raise HTTPException(status_code=502, detail=f"Spotify API returned {status}: {body_text}")

        try:
            data = json.loads(body_text)
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to parse Spotify response")

        items.extend(data.get("items", []))
        url = data.get("next")

    playlists = []
    for p in items:
        playlists.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "owner": (p.get("owner") or {}).get("display_name") or (p.get("owner") or {}).get("id"),
            "tracks_total": (p.get("tracks") or {}).get("total"),
            "images": p.get("images", []),
            "external_url": (p.get("external_urls") or {}).get("spotify"),
        })

    return {"playlists": playlists}

@api_router.get("/routes")
def list_routes():
    return [r.path for r in app.router.routes]


app.include_router(api_router)

# Catch all for serving React Frontend
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """
    Serves the index.html file for all non-API, non-static routes.
    """
    index_path = FRONTEND_DIST / "index.html"
    file_path = FRONTEND_DIST / full_path

    # Serve 'index.html' for deep links (e.g., /playlists)
    # or if the path is a directory
    if not file_path.exists() or file_path.is_dir():
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="React app index.html not found")
        return FileResponse(index_path)

    # Serve static files from the root (like favicon.ico, manifest.json)
    return FileResponse(file_path)