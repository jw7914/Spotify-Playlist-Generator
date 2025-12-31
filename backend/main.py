from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
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

API_KEY = os.getenv("GEMINI_API_KEY")
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI") or "http://127.0.0.1:8000/api/auth/callback"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemma-3-12b-it"

client = genai.Client(api_key=GEMINI_API_KEY)

# --- Pydantic Models ---
class PromptRequest(BaseModel):
    prompt: str

class ChatHistoryItem(BaseModel):
    role: str
    parts: list[str]

class ChatRequest(BaseModel):
    message: str
    history: list[ChatHistoryItem] = []

# --- API Routes ---
@api_router.get("/auth/login")
def login():
    scope = "user-read-private user-read-email user-top-read user-read-recently-played"
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "scope": scope,
        "redirect_uri": REDIRECT_URI,
        "show_dialog": True,
        "state": state,
    }
    auth_url = f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(params)}"
    resp = RedirectResponse(url=auth_url)
    resp.set_cookie("spotify_oauth_state", state, max_age=STATE_TTL, httponly=True, samesite="lax")
    return resp

@api_router.get("/auth/callback")
def callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    # 1. Handle "Access Denied" or upstream errors (e.g. user clicked Cancel)
    if error:
        return RedirectResponse(url="/")

    # 2. Validate Authorization Code
    if not code:
        return RedirectResponse(url="/")

    # 3. Validate OAuth State (CSRF Protection)
    cookie_state = request.cookies.get("spotify_oauth_state")
    if not state or not cookie_state or cookie_state != state:
        return RedirectResponse(url="/")

    # 4. Check Server Configuration
    client_id = SPOTIFY_CLIENT_ID
    client_secret = SPOTIFY_CLIENT_SECRET
    if not client_id or not client_secret:
        # Log this error internally if possible, then redirect user
        print("Error: Missing Spotify credentials")
        return RedirectResponse(url="/")

    # 5. Prepare Token Exchange
    token_url = "https://accounts.spotify.com/api/token"
    redirect_uri = REDIRECT_URI
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    
    auth_str = f"{client_id}:{client_secret}"
    auth_value = base64.b64encode(auth_str.encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_value}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    # 6. Execute Token Exchange
    try:
        encoded = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(token_url, data=encoded, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            body_text = resp.read().decode("utf-8")
            
        if status < 200 or status >= 300:
            print(f"Token endpoint error {status}: {body_text}")
            return RedirectResponse(url="/")

        token_data = json.loads(body_text)
        
    except Exception as e:
        print(f"Token exchange exception: {e}")
        return RedirectResponse(url="/")

    # 7. Success: Set cookies and redirect to profile
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    expires_at = datetime.now().timestamp() + (expires_in or 0)

    resp = RedirectResponse(url="/profile")
    resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
    if refresh_token:
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
    resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    
    # Clear the state cookie
    resp.set_cookie("spotify_oauth_state", "", max_age=0)
    
    return resp

@api_router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("expires_at", path="/")
    response.delete_cookie("spotify_oauth_state", path="/")
    return {"message": "Logged out"}

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
        client_id = SPOTIFY_CLIENT_ID
        client_secret = SPOTIFY_CLIENT_SECRET
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
        client_id = SPOTIFY_CLIENT_ID
        client_secret = SPOTIFY_CLIENT_SECRET
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
        client_id = SPOTIFY_CLIENT_ID
        client_secret = SPOTIFY_CLIENT_SECRET
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

@api_router.get("/playlists/{playlist_id}")
def get_playlist_details(playlist_id: str, request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    # --- Token Refresh Logic (Identical to your other routes) ---
    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        token_url = "https://accounts.spotify.com/api/token"
        client_id = SPOTIFY_CLIENT_ID
        client_secret = SPOTIFY_CLIENT_SECRET
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

        # Retry the request with new token
        resp = RedirectResponse(url=f"/api/playlists/{playlist_id}")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    # --- Main API Request ---
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    url = f"{API_BASE_URL}/playlists/{playlist_id}"
    
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

    # --- Response Formatting ---
    # Map the raw Spotify data to the structure expected by the React component
    
    tracks_data = data.get("tracks", {})
    items_raw = tracks_data.get("items", [])
    formatted_tracks = []

    for item in items_raw:
        track_obj = item.get("track")
        # Skip if track object is missing (can happen in Spotify playlists)
        if not track_obj:
            continue
            
        formatted_tracks.append({
            "added_at": item.get("added_at"),
            "track": {
                "id": track_obj.get("id"),
                "name": track_obj.get("name"),
                "duration_ms": track_obj.get("duration_ms"),
                "uri": track_obj.get("uri"),
                "external_urls": track_obj.get("external_urls", {}),
                "album": {
                    "id": track_obj.get("album", {}).get("id"),
                    "name": track_obj.get("album", {}).get("name"),
                    "images": track_obj.get("album", {}).get("images", []),
                },
                "artists": [
                    {
                        "id": artist.get("id"),
                        "name": artist.get("name"),
                        "external_urls": artist.get("external_urls", {})
                    } for artist in track_obj.get("artists", [])
                ]
            }
        })

    playlist_details = {
        "id": data.get("id"),
        "name": data.get("name"),
        "description": data.get("description"),
        "images": data.get("images", []),
        "owner": {
            "display_name": data.get("owner", {}).get("display_name")
        },
        "followers": {
            "total": data.get("followers", {}).get("total")
        },
        "external_urls": (data.get("external_urls") or {}).get("spotify"),
        "tracks": {
            "total": tracks_data.get("total"),
            "items": formatted_tracks
        }
    }

    return playlist_details

@api_router.get("/recently-played")
def get_recently_played(request: Request, limit: int = 10):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    # --- Token Refresh Logic ---
    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        token_url = "https://accounts.spotify.com/api/token"
        client_id = SPOTIFY_CLIENT_ID
        client_secret = SPOTIFY_CLIENT_SECRET
        
        data = {"grant_type": "refresh_token", "refresh_token": refresh_token}
        auth_value = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_value}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        encoded = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(token_url, data=encoded, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body_text = resp.read().decode("utf-8")
                token_data = json.loads(body_text)
                access_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in")
                expires_at = datetime.now().timestamp() + (expires_in or 0)
        except Exception:
             return RedirectResponse(url="/api/auth/login")
             
    # --- Recent Tracks Request ---
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Using 'before' cursor is often better for consistency, but standard limit works for latest
    params = {"limit": limit}
    url = f"{API_BASE_URL}/me/player/recently-played?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            body_text = resp.read().decode("utf-8")
            data = json.loads(body_text)
    except urllib.error.HTTPError as he:
        # If user is missing the scope 'user-read-recently-played', this will 403
        if he.code == 403:
            raise HTTPException(status_code=403, detail="Missing permissions. Re-login required.")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    # Format response
    formatted_items = []
    for item in data.get("items", []):
        track = item.get("track", {})
        formatted_items.append({
            "played_at": item.get("played_at"),
            "track": {
                "id": track.get("id"),
                "name": track.get("name"),
                "duration_ms": track.get("duration_ms"),
                "artists": [{"name": a["name"]} for a in track.get("artists", [])],
                "image": track.get("album", {}).get("images", [{}])[0].get("url"),
                "external_url": track.get("external_urls", {}).get("spotify")
            }
        })

    # Save new cookies if we refreshed
    if datetime.now().timestamp() > float(expires_at_raw or 0):
        resp = JSONResponse({"items": formatted_items})
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
        
    return {"items": formatted_items}

@api_router.get("/routes")
def list_routes():
    return [r.path for r in app.router.routes]

@api_router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        # 1. Prepare the conversation history
        # We start with an empty list for the SDK contents
        chat_contents = []

        # 2. Add System Instruction (Optional but recommended)
        # This gives the AI its "persona" as a music assistant.
        # Note: In the new SDK, system instructions are often passed as config, 
        # but a simple way is to prepend it as a 'user' message or rely on model config.
        # For simplicity here, we stick to the message history.
        
        # 3. Convert Frontend History to SDK 'Content' objects
        for item in request.history:
            chat_contents.append(types.Content(
                role=item.role, # Must be "user" or "model"
                parts=[types.Part.from_text(text=p) for p in item.parts]
            ))

        # 4. Add the CURRENT user message to the end
        chat_contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=request.message)]
        ))

        # 5. Call the API with the FULL history
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=chat_contents
        )

        # 6. Return the text AND the updated history
        # The frontend needs the new history to maintain state
        updated_history = request.history + [
            ChatHistoryItem(role="user", parts=[request.message]),
            ChatHistoryItem(role="model", parts=[response.text])
        ]

        return {
            "text": response.text,
            "history": updated_history
        }

    except Exception as e:
        print(f"Chat Error: {e}") # Check your terminal if this fails!
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")



@api_router.get("/models")
def get_models():
    try:
        models = []
        # Iterate through the models and print their names
        for m in client.models.list():
            models.append({
                "name": m.name,
                "display_name": m.display_name,
                "description": m.description,
                "supported_actions": m.supported_actions
            })

        return {"count": len(models), "models": models}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@api_router.get("/test")
async def test_ai_connection(q: str):
    """
    Simple GET endpoint to test if Gemini is reachable.
    Usage: http://localhost:8000/api/test?q=Hello
    """
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=q
        )
        return {
            "status": "ok",
            "query": q,
            "ai_response": response.text
        }
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e)
        }
    
app.include_router(api_router)

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