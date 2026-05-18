from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import RedirectResponse, JSONResponse
import urllib.parse
import urllib.request
import urllib.error
import json
import base64
import secrets
from collections import Counter
from datetime import datetime
import os
from backend.routers.spotify_models import (
    CreatePlaylistRequest,
    AddTracksRequest,
    UpdatePlaylistRequest,
    SaveIdsRequest,
    TransferPlaybackRequest,
    AddToQueueRequest,
    SetPlaylistImageRequest,
)

API_BASE_URL = "https://api.spotify.com/v1"
STATE_TTL = 300
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI") or "http://127.0.0.1:8000/api/spotify/auth/callback"

router = APIRouter()

# --- App Token Implementation (Client Credentials) ---
_cached_token = {"token": None, "expires_at": 0}

def get_app_token():
    now = datetime.now().timestamp()

    if _cached_token["token"] and now < _cached_token["expires_at"] - 60:
        return _cached_token["token"]
        
    token_url = "https://accounts.spotify.com/api/token"
    
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_b64 = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    
    try:
        req = urllib.request.Request(token_url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode())
            _cached_token["token"] = body["access_token"]
            _cached_token["expires_at"] = now + body["expires_in"]
            return _cached_token["token"]
    except Exception as e:
        print(f"Failed to fetch Spotify token: {e}")
        return None


def _get_valid_user_access_token(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Session expired")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    return access_token, expires_at, new_cookie_needed


def _spotify_json_request(url: str, headers: dict, method: str = "GET", payload=None, timeout: int = 10):
    data_bytes = None
    if payload is not None:
        data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        if not body:
            return None
        return json.loads(body.decode("utf-8"))

# --- Helper: Token Refresh Logic ---
def handle_token_refresh(refresh_token: str):
    """Helper to refresh Spotify token using urllib"""
    if not refresh_token:
        return None

    token_url = "https://accounts.spotify.com/api/token"
    
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_value = base64.b64encode(auth_str.encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_value}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        encoded = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(token_url, data=encoded, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            body_text = resp.read().decode("utf-8")
            return json.loads(body_text)
    except Exception as e:
        print(f"Token refresh failed: {e}")
        return None

# --- FastAPI Authentication Dependency ---
def get_current_user_id(request: Request) -> str:
    """FastAPI dependency to get the current authenticated user's Spotify ID."""
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in with Spotify.")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
        access_token = token_data.get("access_token")

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/me"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("id")
    except urllib.error.HTTPError as he:
        if he.code == 401:
            raise HTTPException(status_code=401, detail="Spotify token invalid or expired.")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to verify user identity.")


# --- Auth Routes ---

@router.get("/auth/login")
def login():
    scope = (
        "user-read-private user-read-email user-top-read "
        "user-read-recently-played user-read-currently-playing user-read-playback-state "
        "user-modify-playback-state user-library-read user-library-modify "
        "user-follow-read user-follow-modify ugc-image-upload "
        "playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative"
    )
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

@router.get("/auth/callback")
def callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    if error or not code:
        return RedirectResponse(url="/")

    cookie_state = request.cookies.get("spotify_oauth_state")
    if not state or not cookie_state or cookie_state != state:
        return RedirectResponse(url="/")

    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return RedirectResponse(url="/")

    token_url = "https://accounts.spotify.com/api/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
    }
    
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_value = base64.b64encode(auth_str.encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_value}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        encoded = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(token_url, data=encoded, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            body_text = resp.read().decode("utf-8")
            
        if status < 200 or status >= 300:
            return RedirectResponse(url="/")

        token_data = json.loads(body_text)
        
    except Exception:
        return RedirectResponse(url="/")

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

@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("expires_at", path="/")
    response.delete_cookie("spotify_oauth_state", path="/")
    return {"message": "Logged out"}

@router.get("/auth/status")
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

# --- Data Routes ---

@router.get("/playlists")
def get_playlists(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
             raise HTTPException(status_code=401, detail="Session expired")
        
        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in")
        expires_at = datetime.now().timestamp() + (expires_in or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    items = []
    url = f"{API_BASE_URL}/me/playlists"
    
    while url:
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body_text = resp.read().decode("utf-8")
                data = json.loads(body_text)
                items.extend(data.get("items", []))
                url = data.get("next")
        except urllib.error.HTTPError as he:
            if he.code == 401:
                return RedirectResponse(url="/api/auth/login")
            raise HTTPException(status_code=502, detail=f"Spotify API Error: {he}")
        except Exception as e:
             raise HTTPException(status_code=502, detail=f"Spotify API Error: {e}")

    playlists = []
    for p in items:
        playlists.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "owner": (p.get("owner") or {}).get("display_name") or (p.get("owner") or {}).get("id"),
            "owner_id": (p.get("owner") or {}).get("id"),
            "tracks_total": (p.get("tracks") or {}).get("total"),
            "images": p.get("images", []),
            "public": p.get("public"),
            "external_url": (p.get("external_urls") or {}).get("spotify"),
        })

    resp = JSONResponse({"playlists": playlists})
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    return resp

@router.get("/playlists/{playlist_id}")
def get_playlist_details(playlist_id: str, request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
             raise HTTPException(status_code=401, detail="Session expired")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/playlists/{playlist_id}"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    # Formatting logic
    tracks_data = data.get("tracks", {})
    items_raw = tracks_data.get("items", [])
    formatted_tracks = []

    for item in items_raw:
        track_obj = item.get("track")
        if not track_obj: continue
            
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
                    {"id": a.get("id"), "name": a.get("name"), "external_urls": a.get("external_urls", {})} 
                    for a in track_obj.get("artists", [])
                ]
            }
        })

    data_resp = {
        "id": data.get("id"),
        "name": data.get("name"),
        "description": data.get("description"),
        "public": data.get("public"),
        "images": data.get("images", []),
        "owner": {
            "display_name": data.get("owner", {}).get("display_name"),
            "id": data.get("owner", {}).get("id")
        },
        "followers": {"total": data.get("followers", {}).get("total")},
        "external_urls": (data.get("external_urls") or {}).get("spotify"),
        "tracks": {"total": tracks_data.get("total"), "items": formatted_tracks}
    }

    resp = JSONResponse(data_resp)
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    return resp

@router.post("/playlists")
def create_playlist(body: CreatePlaylistRequest, request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    
    # 1. Get User ID
    user_url = f"{API_BASE_URL}/me"
    try:
        req = urllib.request.Request(user_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            user_data = json.loads(resp.read().decode("utf-8"))
            user_id = user_data.get("id")
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Failed to get user ID: {he}")

    # 2. Create Playlist
    url = f"{API_BASE_URL}/users/{user_id}/playlists"
    payload = {
        "name": body.name,
        "description": body.description,
        "public": body.public,
        "collaborative": False
    }
    
    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            new_playlist = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    resp = JSONResponse(new_playlist)
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    
    return resp

@router.delete("/playlists/{playlist_id}")
def delete_playlist(playlist_id: str, request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/playlists/{playlist_id}/followers"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=10) as resp:
            # DELETE usually returns 200 OK or 204 No Content
            pass
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    resp = JSONResponse({"message": "Playlist deleted (unfollowed)"})
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    
    return resp

@router.post("/playlists/{playlist_id}/tracks")
def add_tracks_to_playlist(playlist_id: str, body: AddTracksRequest, request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    url = f"{API_BASE_URL}/playlists/{playlist_id}/tracks"
    
    try:
        data_bytes = json.dumps({"uris": body.uris}).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    if new_cookie_needed:
        resp = JSONResponse(data)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    return data



@router.delete("/playlists/{playlist_id}/tracks")
def remove_tracks_from_playlist(playlist_id: str, body: AddTracksRequest, request: Request):
    """
    Remove tracks from a playlist.
    Expects body.uris to be a list of Spotify track URIs to remove.
    """
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    url = f"{API_BASE_URL}/playlists/{playlist_id}/tracks"
    
    # Spotify API expects: { "tracks": [{ "uri": "spotify:track:..." }] }
    tracks_payload = [{"uri": uri} for uri in body.uris]
    payload = {"tracks": tracks_payload}

    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="DELETE")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    if new_cookie_needed:
        resp = JSONResponse(data)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    return data


# --- Backend helpers (for server-side use, e.g. Gemini) ---

def get_user_playlists_context(request: Request, limit_tracks: int = 10) -> str:
    """Fetch a brief summary of the user's playlists and their tracks to provide context to the AI."""
    if not request:
        return ""
    
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return ""

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            return ""
        access_token = token_data.get("access_token")

    headers = {"Authorization": f"Bearer {access_token}"}
    playlists_url = f"{API_BASE_URL}/me/playlists?limit=50"
    
    context_lines = ["User's existing Spotify Playlists:"]
    
    playlists = []
    while playlists_url:
        try:
            req = urllib.request.Request(playlists_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                playlists.extend(data.get("items", []))
                playlists_url = data.get("next")
        except Exception as e:
            print(f"Failed to fetch user playlists for context: {e}")
            break
        
    if not playlists:
        return "The user currently has no playlists on Spotify."

    for p in playlists:
        if not p: continue
        p_name = p.get("name")
        p_id = p.get("id")
        
        p_image = ""
        images = p.get("images", [])
        if images and len(images) > 0:
            p_image = images[0].get("url", "")
        
        tracks_url = f"{API_BASE_URL}/playlists/{p_id}/tracks?limit={limit_tracks}"
        try:
            treq = urllib.request.Request(tracks_url, headers=headers, method="GET")
            with urllib.request.urlopen(treq, timeout=5) as tresp:
                tdata = json.loads(tresp.read().decode("utf-8"))
                track_items = tdata.get("items", [])
        except Exception as e:
            print(f"Failed to fetch tracks for playlist {p_name}: {e}")
            track_items = []
            
        track_names = []
        for item in track_items:
            track_obj = item.get("track")
            if track_obj:
                t_name = track_obj.get("name")
                artists = ", ".join([a.get("name") for a in track_obj.get("artists", []) if a.get("name")])
                track_names.append(f"'{t_name}' by {artists}")
                
        if track_names:
            context_lines.append(f"- Playlist '{p_name}' (ID: {p_id}, Image: {p_image}): {', '.join(track_names)}")
        else:
            context_lines.append(f"- Playlist '{p_name}' (ID: {p_id}, Image: {p_image}): (no tracks or unable to fetch)")

    return "\n".join(context_lines)

def get_user_top_tastes_context(request: Request) -> str:
    """Fetch a brief summary of the user's top artists, genres, and tracks to provide context to the AI."""
    if not request:
        return ""
    
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return ""

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            return ""
        access_token = token_data.get("access_token")

    headers = {"Authorization": f"Bearer {access_token}"}
    
    context_lines = []
    
    # 1. Fetch Top Artists & Genres
    artists_url = f"{API_BASE_URL}/me/top/artists?limit=15&time_range=medium_term"
    try:
        req = urllib.request.Request(artists_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            artists_items = data.get("items", [])
            
            top_artists = []
            all_genres = set()
            for a in artists_items:
                top_artists.append(a.get("name"))
                for g in a.get("genres", []):
                    all_genres.add(g)
            
            if top_artists:
                context_lines.append(f"User's Top Artists: {', '.join(top_artists)}")
            if all_genres:
                context_lines.append(f"User's Top Genres: {', '.join(list(all_genres)[:15])}")
    except Exception as e:
        print(f"Failed to fetch top artists for context: {e}")

    # 2. Fetch Top Tracks
    tracks_url = f"{API_BASE_URL}/me/top/tracks?limit=10&time_range=medium_term"
    try:
        req = urllib.request.Request(tracks_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tracks_items = data.get("items", [])
            
            top_tracks = []
            for t in tracks_items:
                t_name = t.get("name")
                artists = ", ".join([a.get("name") for a in t.get("artists", []) if a.get("name")])
                top_tracks.append(f"'{t_name}' by {artists}")
            
            if top_tracks:
                context_lines.append(f"User's Top Tracks: {', '.join(top_tracks)}")
    except Exception as e:
        print(f"Failed to fetch top tracks for context: {e}")

    if not context_lines:
        return ""
        
    return "\n" + "\n".join(context_lines)


def _get_spotify_user_access_token(request: Request) -> str | None:
    if not request:
        return None

    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return None

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            return None
        access_token = token_data.get("access_token")

    return access_token


def get_user_top_artists_data(
    request: Request,
    time_range: str = "medium_term",
    limit: int = 10,
) -> list[dict]:
    access_token = _get_spotify_user_access_token(request)
    if not access_token:
        return []

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"time_range": time_range, "limit": limit}
    url = f"{API_BASE_URL}/me/top/artists?{urllib.parse.urlencode(params)}"

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Failed to fetch top artists data: {e}")
        return []

    artists = []
    for a in data.get("items", []):
        artists.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "genres": a.get("genres", []),
            "popularity": a.get("popularity"),
            "external_url": (a.get("external_urls") or {}).get("spotify"),
        })

    return artists


def get_user_top_tracks_data(
    request: Request,
    time_range: str = "medium_term",
    limit: int = 10,
) -> list[dict]:
    access_token = _get_spotify_user_access_token(request)
    if not access_token:
        return []

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"time_range": time_range, "limit": limit}
    url = f"{API_BASE_URL}/me/top/tracks?{urllib.parse.urlencode(params)}"

    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Failed to fetch top tracks data: {e}")
        return []

    tracks = []
    for t in data.get("items", []):
        tracks.append({
            "id": t.get("id"),
            "name": t.get("name"),
            "artists": [a.get("name") for a in t.get("artists", []) if a.get("name")],
            "album": t.get("album", {}).get("name"),
            "external_url": (t.get("external_urls") or {}).get("spotify"),
        })

    return tracks


def get_user_top_genres_data(
    request: Request,
    time_range: str = "medium_term",
    artist_limit: int = 20,
    genre_limit: int = 10,
) -> list[dict]:
    artists = get_user_top_artists_data(
        request=request,
        time_range=time_range,
        limit=artist_limit,
    )
    if not artists:
        return []

    genre_counts: dict[str, int] = {}
    for artist in artists:
        for genre in artist.get("genres", []):
            genre_counts[genre] = genre_counts.get(genre, 0) + 1

    ranked_genres = sorted(
        genre_counts.items(),
        key=lambda item: (-item[1], item[0]),
    )

    return [
        {"name": genre, "artist_count": count}
        for genre, count in ranked_genres[:genre_limit]
    ]


def get_user_taste_profile_data(
    request: Request,
    time_range: str = "medium_term",
    artist_limit: int = 10,
    track_limit: int = 10,
    genre_limit: int = 10,
) -> dict:
    artists = get_user_top_artists_data(
        request=request,
        time_range=time_range,
        limit=artist_limit,
    )
    tracks = get_user_top_tracks_data(
        request=request,
        time_range=time_range,
        limit=track_limit,
    )
    genres = get_user_top_genres_data(
        request=request,
        time_range=time_range,
        artist_limit=max(artist_limit, genre_limit),
        genre_limit=genre_limit,
    )

    return {
        "time_range": time_range,
        "top_artists": artists,
        "top_tracks": tracks,
        "top_genres": genres,
    }

def create_playlist(
    name: str,
    description: str | None = None,
    public: bool = False,
    request: Request | None = None,
):
    """Create a playlist. Requires request for cookies (access_token)."""
    if not request:
        raise HTTPException(status_code=401, detail="Request required for authentication")
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Token refresh failed")
        access_token = token_data.get("access_token")

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    user_url = f"{API_BASE_URL}/me"
    try:
        req = urllib.request.Request(user_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            user_data = json.loads(resp.read().decode("utf-8"))
            user_id = user_data.get("id")
    except urllib.error.HTTPError as he:
        if he.code == 401:
            raise HTTPException(status_code=401, detail="Not authenticated")
        raise HTTPException(status_code=502, detail=f"Failed to get user ID: {he}")

    url = f"{API_BASE_URL}/users/{user_id}/playlists"
    payload = {
        "name": name,
        "description": description or "",
        "public": public,
        "collaborative": False,
    }
    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401:
            raise HTTPException(status_code=401, detail="Not authenticated")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")


def search_spotify_songs(
    query: str,
    type: str = "track",
    limit: int = 1,
):
    """Search Spotify (uses app token, no user auth)."""
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"q": query, "type": type, "limit": limit}
    url = f"{API_BASE_URL}/search?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")


def add_tracks_to_playlist(
    playlist_id: str,
    track_ids: list[str],
    request: Request | None = None,
):
    """Add tracks to a playlist. Requires request for cookies (access_token)."""
    if not request:
        raise HTTPException(status_code=401, detail="Request required for authentication")
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Token refresh failed")
        access_token = token_data.get("access_token")

    uris = [f"spotify:track:{tid}" for tid in track_ids]
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    url = f"{API_BASE_URL}/playlists/{playlist_id}/tracks"
    try:
        data_bytes = json.dumps({"uris": uris}).encode("utf-8")
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401:
            raise HTTPException(status_code=401, detail="Not authenticated")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")


@router.get("/me")
def get_me(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
             raise HTTPException(status_code=401, detail="Session expired")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/me"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    data_resp = {
        "user": {
            "id": data.get("id"),
            "display_name": data.get("display_name"),
            "email": data.get("email"),
            "images": data.get("images", []),
            "external_url": (data.get("external_urls") or {}).get("spotify"),
        }
    }
    resp = JSONResponse(data_resp)
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    return resp

@router.get("/top-artists")
def get_top_artists(request: Request, time_range: str = "medium_term", limit: int = 20):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Session expired")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"time_range": time_range, "limit": limit}
    url = f"{API_BASE_URL}/me/top/artists?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    artists = []
    for a in data.get("items", []):
        artists.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "genres": a.get("genres", []),
            "images": a.get("images", []),
            "popularity": a.get("popularity"),
            "external_url": (a.get("external_urls") or {}).get("spotify"),
        })

    resp = JSONResponse({"artists": artists})
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    return resp

@router.get("/top-tracks")
def get_top_tracks(request: Request, time_range: str = "medium_term", limit: int = 20):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Session expired")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"time_range": time_range, "limit": limit}
    url = f"{API_BASE_URL}/me/top/tracks?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    tracks = []
    for t in data.get("items", []):
        tracks.append({
            "id": t.get("id"),
            "name": t.get("name"),
            "artists": [{"name": a.get("name")} for a in t.get("artists", [])],
            "album": {
                "name": t.get("album", {}).get("name"),
                "image": t.get("album", {}).get("images", [{}])[0].get("url")
            },
            "duration_ms": t.get("duration_ms"),
            "uri": t.get("uri"),
            "external_url": (t.get("external_urls") or {}).get("spotify"),
        })

    resp = JSONResponse({"tracks": tracks})
    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    return resp

@router.get("/recently-played")
def get_recently_played(request: Request, limit: int = 10):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"limit": limit}
    url = f"{API_BASE_URL}/me/player/recently-played?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 403: raise HTTPException(status_code=403, detail="Missing permissions.")
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

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

    if new_cookie_needed:
        resp = JSONResponse({"items": formatted_items})
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
        

    return {"items": formatted_items}

@router.get("/currently-playing")
def get_currently_playing(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    
    # "market=from_token" is often safer to ensure track linking works
    url = f"{API_BASE_URL}/me/player/currently-playing?market=from_token"
    
    data = None
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            # 204 No Content means nothing is playing
            if resp.status == 204:
                data = None
            else:
                body_text = resp.read().decode("utf-8")
                # Sometimes body might be empty even if 200? Spotify is quirky.
                if body_text:
                    data = json.loads(body_text)
                else:
                    data = None

    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        # 204 might come as error in some libs, but urllib usually handles status above.
        # Just in case:
        if he.code == 204: 
             data = None
        else:
             raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    # Build response
    resp_obj = {"is_playing": False, "item": None}
    
    if data and data.get("item"):
        # We have a track (or episode, but let's assume track for now or handle basic info)
        item = data.get("item")
        is_playing = data.get("is_playing", False)
        
        # Helper to safely get images
        album_images = item.get("album", {}).get("images", [])
        image_url = album_images[0]["url"] if album_images else None

        resp_obj = {
            "is_playing": is_playing,
            "item": {
                "id": item.get("id"),
                "name": item.get("name"),
                "artists": [{"name": a.get("name")} for a in item.get("artists", [])],
                "album": {"name": item.get("album", {}).get("name"), "image": image_url},
                "duration_ms": item.get("duration_ms"),
                "progress_ms": data.get("progress_ms"),
                "external_url": (item.get("external_urls") or {}).get("spotify")
            }
        }

    if new_cookie_needed:
        response = JSONResponse(resp_obj)
        response.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        response.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return response

    return resp_obj

# --- Player Controls ---

def _proxy_player_request(request: Request, method: str, endpoint: str):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/me/player/{endpoint}"
    
    try:
        req = urllib.request.Request(url, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as resp:
            # 204 No Content is expected for these calls
            pass
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        # 403 usually means premium required or scope missing, or no active device
        raise HTTPException(status_code=he.code, detail=f"Spotify Error: {he}")

    if new_cookie_needed:
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    return resp

@router.get("/player/queue")
def get_queue(request: Request):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    new_cookie_needed = False
    
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/me/player/queue"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        # 403 Forbidden might happen if scope is missing (user needs to re-login)
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    if new_cookie_needed:
        resp = JSONResponse(data)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    return data

@router.put("/player/play")
def play_playback(request: Request):
    return _proxy_player_request(request, "PUT", "play")

@router.put("/player/pause")
def pause_playback(request: Request):
    return _proxy_player_request(request, "PUT", "pause")

@router.post("/player/next")
def next_track(request: Request):
    return _proxy_player_request(request, "POST", "next")

@router.post("/player/previous")
def previous_track(request: Request):
    return _proxy_player_request(request, "POST", "previous")

@router.get("/search")
def search_spotify(request: Request, q: str, type: str = "track", limit: int = 20):
    # Use App Token (Public Search)
    access_token = get_app_token()
    if not access_token: 
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"q": q, "type": type, "limit": limit}
    url = f"{API_BASE_URL}/search?{urllib.parse.urlencode(params)}"
    
    # ... standard request ...
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    # Return raw structure or format it. For search, raw is often versatile enough for the frontend
    # but let's format slightly to match our other endpoints if necessary.
    # For now, returning standard Spotify search response structure.
    
    return data


@router.get("/recommendations")
def get_recommendations(request: Request, limit: int = 12):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    new_cookie_needed = False
    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
            raise HTTPException(status_code=401, detail="Session expired")
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        new_cookie_needed = True

    headers = {"Authorization": f"Bearer {access_token}"}

    def fetch_json(url: str):
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def normalize_name(value: str | None) -> str:
        return (value or "").strip().lower()

    def avg(values: list[float]) -> float | None:
        if not values:
            return None
        return sum(values) / len(values)

    def fetch_audio_features(track_ids: list[str]) -> dict[str, dict]:
        unique_ids = [track_id for track_id in dict.fromkeys(track_ids) if track_id]
        features_by_id: dict[str, dict] = {}
        for start in range(0, len(unique_ids), 100):
            batch = unique_ids[start:start + 100]
            if not batch:
                continue
            try:
                data = fetch_json(
                    f"{API_BASE_URL}/audio-features?{urllib.parse.urlencode({'ids': ','.join(batch)})}"
                )
            except Exception as exc:
                print(f"Failed to fetch audio features for recommendations: {exc}")
                continue
            for feature in data.get("audio_features", []) if data else []:
                if feature and feature.get("id"):
                    features_by_id[feature["id"]] = feature
        return features_by_id

    def extract_seed_genres(artists: list[dict], available_genres: set[str], limit_count: int = 5) -> list[str]:
        genre_counter: Counter[str] = Counter()
        for artist in artists:
            popularity = artist.get("popularity") or 0
            for genre in artist.get("genres", []):
                if genre in available_genres:
                    genre_counter[genre] += max(1, popularity // 10)
        return [genre for genre, _ in genre_counter.most_common(limit_count)]

    try:
        top_artists_by_range = {
            "short_term": get_user_top_artists_data(request, "short_term", 8),
            "medium_term": get_user_top_artists_data(request, "medium_term", 8),
            "long_term": get_user_top_artists_data(request, "long_term", 8),
        }
        top_tracks_by_range = {
            "short_term": get_user_top_tracks_data(request, "short_term", 8),
            "medium_term": get_user_top_tracks_data(request, "medium_term", 8),
            "long_term": get_user_top_tracks_data(request, "long_term", 8),
        }
        recent_tracks: list[dict] = []
        try:
            recent_data = fetch_json(f"{API_BASE_URL}/me/player/recently-played?limit=10")
            recent_tracks = [
                item.get("track", {})
                for item in recent_data.get("items", [])
                if item.get("track", {}).get("id")
            ]
        except Exception as exc:
            print(f"Failed to fetch recent tracks for recommendations: {exc}")

        all_top_artists = [
            artist
            for bucket in top_artists_by_range.values()
            for artist in bucket
            if artist.get("id")
        ]
        all_top_tracks = [
            track
            for bucket in top_tracks_by_range.values()
            for track in bucket
            if track.get("id")
        ]

        if not all_top_tracks and not all_top_artists and not recent_tracks:
            raise HTTPException(status_code=404, detail="Not enough listening history for recommendations")

        app_token = get_app_token()
        available_genres: set[str] = set()
        if app_token:
            try:
                app_headers = {"Authorization": f"Bearer {app_token}"}
                genres_data = _spotify_json_request(
                    f"{API_BASE_URL}/recommendations/available-genre-seeds",
                    app_headers,
                )
                available_genres = set((genres_data or {}).get("genres", []))
            except Exception as exc:
                print(f"Failed to fetch available genre seeds for recommendations: {exc}")

        weighted_track_ids: list[str] = []
        weighted_artist_ids: list[str] = []
        for time_range, multiplier in (("short_term", 3), ("medium_term", 2), ("long_term", 1)):
            for track in top_tracks_by_range[time_range]:
                weighted_track_ids.extend([track["id"]] * multiplier)
            for artist in top_artists_by_range[time_range]:
                weighted_artist_ids.extend([artist["id"]] * multiplier)
        for track in recent_tracks[:5]:
            weighted_track_ids.extend([track["id"]] * 4)
            for artist in track.get("artists", []):
                if artist.get("id"):
                    weighted_artist_ids.extend([artist["id"]] * 2)

        seed_tracks = [track_id for track_id, _ in Counter(weighted_track_ids).most_common(2)]
        seed_artists = [artist_id for artist_id, _ in Counter(weighted_artist_ids).most_common(2)]
        seed_genres = extract_seed_genres(all_top_artists, available_genres, 3)

        # Spotify recommendations accepts a total of 5 seeds.
        seed_plan: list[tuple[str, list[str]]] = [
            ("seed_tracks", seed_tracks),
            ("seed_artists", seed_artists),
            ("seed_genres", seed_genres),
        ]
        final_seed_params: dict[str, str] = {}
        used_seed_slots = 0
        for key, values in seed_plan:
            if used_seed_slots >= 5:
                break
            allowed = values[: max(0, 5 - used_seed_slots)]
            if allowed:
                final_seed_params[key] = ",".join(allowed)
                used_seed_slots += len(allowed)

        profile_track_ids: list[str] = []
        profile_track_ids.extend([track["id"] for track in top_tracks_by_range["short_term"][:5]])
        profile_track_ids.extend([track["id"] for track in top_tracks_by_range["medium_term"][:5]])
        profile_track_ids.extend([track["id"] for track in top_tracks_by_range["long_term"][:5]])
        profile_track_ids.extend([track.get("id") for track in recent_tracks[:5] if track.get("id")])
        features_by_id = fetch_audio_features(profile_track_ids)

        feature_fields = [
            "danceability",
            "energy",
            "valence",
            "acousticness",
            "instrumentalness",
            "speechiness",
        ]
        target_audio_profile: dict[str, float] = {}
        for field in feature_fields:
            values = [
                float(features_by_id[track_id][field])
                for track_id in profile_track_ids
                if track_id in features_by_id and features_by_id[track_id].get(field) is not None
            ]
            field_avg = avg(values)
            if field_avg is not None:
                target_audio_profile[field] = round(field_avg, 3)

        tempo_values = [
            float(features_by_id[track_id]["tempo"])
            for track_id in profile_track_ids
            if track_id in features_by_id and features_by_id[track_id].get("tempo") is not None
        ]
        tempo_avg = avg(tempo_values)
        if tempo_avg is not None:
            target_audio_profile["tempo"] = round(tempo_avg, 2)

        params = {
            "limit": max(15, min(limit * 2, 30)),
            "market": "from_token",
        }
        params.update(final_seed_params)
        for field, value in target_audio_profile.items():
            params[f"target_{field}"] = value

        recs_data = fetch_json(f"{API_BASE_URL}/recommendations?{urllib.parse.urlencode(params)}")
    except urllib.error.HTTPError as he:
        if he.code == 401:
            raise HTTPException(status_code=401, detail="Spotify token invalid or expired.")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {e}")

    user_top_artist_ids = {artist["id"] for artist in all_top_artists if artist.get("id")}
    user_top_artist_names = {
        normalize_name(artist.get("name"))
        for artist in all_top_artists
        if artist.get("name")
    }
    user_recent_artist_names = {
        normalize_name(artist.get("name"))
        for track in recent_tracks
        for artist in track.get("artists", [])
        if artist.get("name")
    }
    source_track_ids = {
        track["id"]
        for track in all_top_tracks
        if track.get("id")
    } | {
        track.get("id")
        for track in recent_tracks
        if track.get("id")
    }

    candidate_tracks = recs_data.get("tracks", []) if recs_data else []
    candidate_features = fetch_audio_features([track.get("id") for track in candidate_tracks if track.get("id")])
    seen_signatures: set[tuple[str, tuple[str, ...]]] = set()
    scored_tracks: list[tuple[float, dict]] = []

    for track in candidate_tracks:
        track_id = track.get("id")
        if not track_id or track_id in source_track_ids:
            continue

        track_name = normalize_name(track.get("name"))
        artist_names = tuple(
            normalize_name(artist.get("name"))
            for artist in track.get("artists", [])
            if artist.get("name")
        )
        signature = (track_name, artist_names)
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)

        feature = candidate_features.get(track_id, {})
        audio_distance = 0.0
        compared_fields = 0
        for field in feature_fields + ["tempo"]:
            target_value = target_audio_profile.get(field)
            candidate_value = feature.get(field)
            if target_value is None or candidate_value is None:
                continue
            if field == "tempo":
                audio_distance += min(abs(float(candidate_value) - float(target_value)) / 60.0, 1.0)
            else:
                audio_distance += abs(float(candidate_value) - float(target_value))
            compared_fields += 1
        audio_match = 1.0 - (audio_distance / compared_fields) if compared_fields else 0.5

        artist_id_match = sum(
            1 for artist in track.get("artists", [])
            if artist.get("id") in user_top_artist_ids
        )
        artist_name_match = sum(
            1 for artist in artist_names
            if artist in user_top_artist_names or artist in user_recent_artist_names
        )
        popularity = track.get("popularity") or 0
        popularity_score = max(0.0, 1.0 - (popularity / 100.0))

        score = (
            audio_match * 0.55
            + min(artist_id_match, 2) * 0.14
            + min(artist_name_match, 2) * 0.08
            + popularity_score * 0.12
            + (0.06 if popularity <= 75 else 0.0)
        )
        scored_tracks.append((score, track))

    scored_tracks.sort(
        key=lambda item: (
            -item[0],
            item[1].get("popularity") or 0,
            item[1].get("name") or "",
        )
    )

    tracks = []
    for _, t in scored_tracks[: max(1, min(limit, 20))]:
        tracks.append({
            "id": t.get("id"),
            "name": t.get("name"),
            "artists": [{"name": a.get("name")} for a in t.get("artists", [])],
            "album": {
                "name": t.get("album", {}).get("name"),
                "image": t.get("album", {}).get("images", [{}])[0].get("url")
            },
            "duration_ms": t.get("duration_ms"),
            "uri": t.get("uri"),
            "external_url": (t.get("external_urls") or {}).get("spotify"),
        })

    payload = {
        "tracks": tracks,
        "seed_summary": {
            "track_count": len(final_seed_params.get("seed_tracks", "").split(",")) if final_seed_params.get("seed_tracks") else 0,
            "artist_count": len(final_seed_params.get("seed_artists", "").split(",")) if final_seed_params.get("seed_artists") else 0,
            "genre_count": len(final_seed_params.get("seed_genres", "").split(",")) if final_seed_params.get("seed_genres") else 0,
        },
        "profile_summary": {
            "top_genres": seed_genres,
            "recent_track_count": len(recent_tracks),
            "audio_targets": target_audio_profile,
            "reranked": True,
        },
    }

    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    return payload


@router.get("/audio-features")
def get_audio_features(request: Request, ids: str):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/audio-features?{urllib.parse.urlencode({'ids': ids})}"
    try:
        data = _spotify_json_request(url, headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    return {"audio_features": data.get("audio_features", []) if data else []}


@router.get("/artists/{artist_id}/related-artists")
def get_related_artists(artist_id: str):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/artists/{artist_id}/related-artists"
    try:
        data = _spotify_json_request(url, headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    return {"artists": data.get("artists", []) if data else []}


@router.get("/artists/{artist_id}/top-tracks")
def get_artist_top_tracks(artist_id: str, market: str = "US"):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/artists/{artist_id}/top-tracks?{urllib.parse.urlencode({'market': market})}"
    try:
        data = _spotify_json_request(url, headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    return {"tracks": data.get("tracks", []) if data else []}


@router.get("/albums/{album_id}")
def get_album(album_id: str):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/albums/{album_id}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    return data or {}


@router.get("/albums/{album_id}/tracks")
def get_album_tracks(album_id: str, limit: int = 50, offset: int = 0):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")

    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/albums/{album_id}/tracks?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    return {"items": data.get("items", []) if data else [], "total": data.get("total", 0) if data else 0}


@router.get("/me/tracks")
def get_saved_tracks(request: Request, limit: int = 20, offset: int = 0):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/me/tracks?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"items": data.get("items", []) if data else [], "total": data.get("total", 0) if data else 0}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.put("/me/tracks")
def save_tracks(request: Request, body: SaveIdsRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/tracks", headers, method="PUT", payload={"ids": body.ids})
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"message": "Tracks saved"}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.delete("/me/tracks")
def remove_saved_tracks(request: Request, body: SaveIdsRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/tracks", headers, method="DELETE", payload={"ids": body.ids})
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"message": "Tracks removed"}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.get("/me/albums")
def get_saved_albums(request: Request, limit: int = 20, offset: int = 0):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/me/albums?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"items": data.get("items", []) if data else [], "total": data.get("total", 0) if data else 0}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.put("/me/albums")
def save_albums(request: Request, body: SaveIdsRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/albums", headers, method="PUT", payload={"ids": body.ids})
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"message": "Albums saved"}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.delete("/me/albums")
def remove_saved_albums(request: Request, body: SaveIdsRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/albums", headers, method="DELETE", payload={"ids": body.ids})
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"message": "Albums removed"}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.get("/me/following")
def get_followed_artists(request: Request, limit: int = 20, after: str | None = None):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"type": "artist", "limit": limit}
    if after:
        params["after"] = after
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/me/following?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    artists_payload = (data or {}).get("artists", {})
    payload = {"artists": artists_payload.get("items", []), "cursors": artists_payload.get("cursors", {})}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.put("/me/following")
def follow_artists(request: Request, body: SaveIdsRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    params = urllib.parse.urlencode({"type": "artist"})
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/following?{params}", headers, method="PUT", payload={"ids": body.ids})
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"message": "Artists followed"}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.delete("/me/following")
def unfollow_artists(request: Request, body: SaveIdsRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    params = urllib.parse.urlencode({"type": "artist"})
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/following?{params}", headers, method="DELETE", payload={"ids": body.ids})
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"message": "Artists unfollowed"}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.get("/recommendations/available-genre-seeds")
def get_available_genre_seeds():
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/recommendations/available-genre-seeds", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    return {"genres": data.get("genres", []) if data else []}


@router.put("/playlists/{playlist_id}")
def update_playlist(playlist_id: str, request: Request, body: UpdatePlaylistRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    payload = body.model_dump(exclude_none=True)
    try:
        _spotify_json_request(f"{API_BASE_URL}/playlists/{playlist_id}", headers, method="PUT", payload=payload)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    response_payload = {"message": "Playlist updated"}
    if new_cookie_needed:
        resp = JSONResponse(response_payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return response_payload


@router.put("/playlists/{playlist_id}/image")
def set_playlist_image(playlist_id: str, request: Request, body: SetPlaylistImageRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "image/jpeg"}
    try:
        raw = body.image_base64.encode("utf-8")
        req = urllib.request.Request(f"{API_BASE_URL}/playlists/{playlist_id}/images", data=raw, headers=headers, method="PUT")
        with urllib.request.urlopen(req, timeout=10):
            pass
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    response_payload = {"message": "Playlist image updated"}
    if new_cookie_needed:
        resp = JSONResponse(response_payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return response_payload


@router.get("/browse/categories")
def get_categories(country: str = "US", limit: int = 20, offset: int = 0):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"country": country, "limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/browse/categories?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    categories = (data or {}).get("categories", {})
    return {"items": categories.get("items", []), "total": categories.get("total", 0)}


@router.get("/browse/featured-playlists")
def get_featured_playlists(country: str = "US", limit: int = 20, offset: int = 0):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"country": country, "limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/browse/featured-playlists?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    playlists = (data or {}).get("playlists", {})
    return {"message": (data or {}).get("message"), "items": playlists.get("items", []), "total": playlists.get("total", 0)}


@router.get("/browse/categories/{category_id}/playlists")
def get_category_playlists(category_id: str, country: str = "US", limit: int = 20, offset: int = 0):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"country": country, "limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/browse/categories/{category_id}/playlists?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    playlists = (data or {}).get("playlists", {})
    return {"items": playlists.get("items", []), "total": playlists.get("total", 0)}


@router.get("/browse/new-releases")
def get_new_releases(country: str = "US", limit: int = 20, offset: int = 0):
    access_token = get_app_token()
    if not access_token:
        raise HTTPException(status_code=500, detail="Failed to get app token")
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"country": country, "limit": limit, "offset": offset}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/browse/new-releases?{urllib.parse.urlencode(params)}", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    albums = (data or {}).get("albums", {})
    return {"items": albums.get("items", []), "total": albums.get("total", 0)}


@router.get("/player/devices")
def get_devices(request: Request):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        data = _spotify_json_request(f"{API_BASE_URL}/me/player/devices", headers)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    payload = {"devices": data.get("devices", []) if data else []}
    if new_cookie_needed:
        resp = JSONResponse(payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return payload


@router.put("/player/transfer")
def transfer_playback(request: Request, body: TransferPlaybackRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    payload = {"device_ids": [body.device_id], "play": body.play}
    try:
        _spotify_json_request(f"{API_BASE_URL}/me/player", headers, method="PUT", payload=payload)
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    response_payload = {"message": "Playback transferred"}
    if new_cookie_needed:
        resp = JSONResponse(response_payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return response_payload


@router.post("/player/queue/add")
def add_to_queue(request: Request, body: AddToQueueRequest):
    access_token, expires_at, new_cookie_needed = _get_valid_user_access_token(request)
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"uri": body.uri}
    if body.device_id:
        params["device_id"] = body.device_id
    try:
        req = urllib.request.Request(f"{API_BASE_URL}/me/player/queue?{urllib.parse.urlencode(params)}", headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10):
            pass
    except urllib.error.HTTPError as he:
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")
    response_payload = {"message": "Added to queue"}
    if new_cookie_needed:
        resp = JSONResponse(response_payload)
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp
    return response_payload
