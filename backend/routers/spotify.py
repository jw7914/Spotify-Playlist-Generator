from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
import urllib.parse
import urllib.request
import urllib.error
import json
import base64
import secrets
from datetime import datetime
from config import (
    SPOTIFY_CLIENT_ID, 
    SPOTIFY_CLIENT_SECRET, 
    REDIRECT_URI, 
    API_BASE_URL, 
    STATE_TTL
)

router = APIRouter()

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

# --- Auth Routes ---

@router.get("/auth/login")
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
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
             return RedirectResponse(url="/api/auth/login")
        
        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in")
        expires_at = datetime.now().timestamp() + (expires_in or 0)

        resp = RedirectResponse(url="/api/playlists")
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

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
            "tracks_total": (p.get("tracks") or {}).get("total"),
            "images": p.get("images", []),
            "external_url": (p.get("external_urls") or {}).get("spotify"),
        })

    return {"playlists": playlists}

@router.get("/playlists/{playlist_id}")
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

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
             return RedirectResponse(url="/api/auth/login")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)

        resp = RedirectResponse(url=f"/api/playlists/{playlist_id}")
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

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

    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "description": data.get("description"),
        "images": data.get("images", []),
        "owner": {"display_name": data.get("owner", {}).get("display_name")},
        "followers": {"total": data.get("followers", {}).get("total")},
        "external_urls": (data.get("external_urls") or {}).get("spotify"),
        "tracks": {"total": tracks_data.get("total"), "items": formatted_tracks}
    }

@router.get("/me")
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
        token_data = handle_token_refresh(refresh_token)
        if not token_data:
             return RedirectResponse(url="/api/auth/login")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        
        resp = RedirectResponse(url="/api/me")
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{API_BASE_URL}/me"
    
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        if he.code == 401: return RedirectResponse(url="/api/auth/login")
        raise HTTPException(status_code=502, detail=f"Spotify Error: {he}")

    return {
        "user": {
            "id": data.get("id"),
            "display_name": data.get("display_name"),
            "email": data.get("email"),
            "images": data.get("images", []),
            "external_url": (data.get("external_urls") or {}).get("spotify"),
        }
    }

@router.get("/top-artists")
def get_top_artists(request: Request, time_range: str = "medium_term", limit: int = 20):
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token: return RedirectResponse(url="/api/auth/login")

    try: expires_at = float(expires_at_raw) if expires_at_raw else 0
    except: expires_at = 0

    if datetime.now().timestamp() > expires_at:
        token_data = handle_token_refresh(refresh_token)
        if not token_data: return RedirectResponse(url="/api/auth/login")
        
        access_token = token_data.get("access_token")
        expires_at = datetime.now().timestamp() + (token_data.get("expires_in") or 0)
        
        resp = RedirectResponse(url=f"/api/top-artists?time_range={time_range}&limit={limit}")
        resp.set_cookie("access_token", access_token, httponly=True, samesite="lax")
        resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
        return resp

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

    return {"artists": artists}

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