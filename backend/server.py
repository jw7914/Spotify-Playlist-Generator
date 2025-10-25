from pathlib import Path
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import urllib.parse
import urllib.request
import urllib.error
import json
import base64
from dotenv import load_dotenv
import os
from datetime import datetime
import secrets


# --- Configuration ---
API_BASE_URL = "https://api.spotify.com/v1"

FRONTEND_DIST = (Path(__file__).parent.parent / "frontend" / "dist").resolve()
load_dotenv()

app = FastAPI(title="Spotify Playlist Generator")
api_router = APIRouter(prefix="/api")
STATE_TTL = 300


# --- API Routes ---
@api_router.get("/auth/login")
def login():
    scope = "user-read-private user-read-email user-top-read"
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": os.getenv("SPOTIFY_CLIENT_ID"),
        "response_type": "code",
        "scope": scope,
        "redirect_uri": os.getenv("REDIRECT_URI") or "http://127.0.0.1:8000/api/auth/callback",
        "show_dialog": True,
        "state": state,
    }
    auth_url = f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(params)}"
    resp = RedirectResponse(url=auth_url)
    resp.set_cookie("spotify_oauth_state", state, max_age=STATE_TTL, httponly=True, samesite="lax")
    return resp

@api_router.get("/auth/callback")
def callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        raise HTTPException(status_code=400, detail={"error": error})
    if not code:
        raise HTTPException(status_code=400, detail="Missing 'code' in callback query")

    cookie_state = request.cookies.get("spotify_oauth_state")
    if not state:
        raise HTTPException(status_code=400, detail="Missing 'state' in callback query")
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=400, detail="Invalid or mismatched OAuth state")

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
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    expires_at = datetime.now().timestamp() + (expires_in or 0)

    resp = RedirectResponse(url="/profile")
    resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
    if refresh_token:
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
    resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    resp.set_cookie("spotify_oauth_state", "", max_age=0)
    return resp

@api_router.get("/auth/status")
def auth_status(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return {"authenticated": False}

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    is_expired = datetime.now().timestamp() > expires_at

    if is_expired and not refresh_token:
        return {"authenticated": False}
    
    return {"authenticated": True}


@api_router.get("/playlists")
def get_playlists(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        token_url = "https://accounts.spotify.com/api/token"
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail="Missing Spotify client credentials on server")

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
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
            return RedirectResponse(url="/api/auth/login")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Token refresh failed: {e}")

        if status < 200 or status >= 300:
            return RedirectResponse(url="/api/auth/login")

        try:
            token_data = json.loads(body_text)
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to parse token refresh response")

        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in")
        expires_at = datetime.now().timestamp() + (expires_in or 0)

        resp = RedirectResponse(url="/api/playlists")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    headers = {
        "Authorization": f"Bearer {access_token}"
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


@api_router.get("/top-artists")
def get_top_artists(request: Request, time_range: str = "medium_term", limit: int = 20):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        token_url = "https://accounts.spotify.com/api/token"
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail="Missing Spotify client credentials on server")

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
        auth_value = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_value}",
            "Content-Type": "application/x-www-form-.urlencoded",
        }

        encoded = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(token_url, data=encoded, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.getcode()
                body_text = resp.read().decode("utf-8")
        except urllib.error.HTTPError as he:
            body = he.read().decode("utf-8") if hasattr(he, "read") else ""
            return RedirectResponse(url="/api/auth/login")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Token refresh failed: {e}")

        if status < 200 or status >= 300:
            return RedirectResponse(url="/api/auth/login")

        try:
            token_data = json.loads(body_text)
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to parse token refresh response")

        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in")
        expires_at = datetime.now().timestamp() + (expires_in or 0)

        resp = RedirectResponse(url=f"/api/top-artists?time_range={urllib.parse.quote(time_range)}&limit={int(limit)}")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    params = {
        "time_range": time_range,
        "limit": limit,
    }
    url = f"{API_BASE_URL}/me/top/artists?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
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

    items = data.get("items", [])
    artists = []
    for a in items:
        artists.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "genres": a.get("genres", []),
            "images": a.get("images", []),
            "popularity": a.get("popularity"),
            "external_url": (a.get("external_urls") or {}).get("spotify"),
        })

    return {"artists": artists}


@api_router.get("/me")
def get_me(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        token_url = "https://accounts.spotify.com/api/token"
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise HTTPException(status_code=500, detail="Missing Spotify client credentials on server")

        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
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
            return RedirectResponse(url="/api/auth/login")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Token refresh failed: {e}")

        if status < 200 or status >= 300:
            return RedirectResponse(url="/api/auth/login")

        try:
            token_data = json.loads(body_text)
        except Exception:
            raise HTTPException(status_code=502, detail="Failed to parse token refresh response")

        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in")
        expires_at = datetime.now().timestamp() + (expires_in or 0)

        resp = RedirectResponse(url="/api/me")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    url = f"{API_BASE_URL}/me"
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
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

    user = {
        "id": data.get("id"),
        "display_name": data.get("display_name"),
        "email": data.get("email"),
        "images": data.get("images", []),
        "external_url": (data.get("external_urls") or {}).get("spotify"),
    }

    return {"user": user}

@api_router.get("/routes")
def list_routes():
    return [r.path for r in app.router.routes]


app.include_router(api_router)

app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIST / "assets"),
    name="assets"
)

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """
    Serves static files from the root (like favicon.ico)
    and serves index.html for all other non-API, non-asset routes.
    """
    index_path = FRONTEND_DIST / "index.html"
    file_path = FRONTEND_DIST / full_path

    if file_path.exists() and not file_path.is_dir():
        return FileResponse(file_path)

    if not index_path.exists():
        raise HTTPException(status_code=404, detail="React app index.html not found")
    return FileResponse(index_path)