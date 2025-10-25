from pathlib import Path
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse, FileResponse
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
# lifetime of a state in seconds (used for cookie max_age)
STATE_TTL = 300


# --- API Routes ---
@api_router.get("/auth/login")
def login():
    scope = "user-read-private user-read-email user-top-read"
    # generate a cryptographically secure state and set it in a short-lived cookie
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
    # set a short-lived, httpOnly cookie to help bind the browser session
    resp = RedirectResponse(url=auth_url)
    # Set short-lived, httpOnly cookie containing the state. We will verify it in the callback.
    resp.set_cookie("spotify_oauth_state", state, max_age=STATE_TTL, httponly=True, samesite="lax")
    return resp

@api_router.get("/auth/callback")
def callback(request: Request, code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        raise HTTPException(status_code=400, detail={"error": error})
    if not code:
        raise HTTPException(status_code=400, detail="Missing 'code' in callback query")

    # Verify state parameter using the cookie set at /auth/login to mitigate CSRF
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

    # Set tokens in HttpOnly cookies so multiple browser users can authenticate independently.
    resp = RedirectResponse(url="/profile")
    resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
    if refresh_token:
        resp.set_cookie("refresh_token", refresh_token, httponly=True, samesite="lax")
    resp.set_cookie("expires_at", str(int(expires_at)), httponly=True, samesite="lax")
    # consume the oauth state cookie
    resp.set_cookie("spotify_oauth_state", "", max_age=0)
    return resp

@api_router.get("/playlists")
def get_playlists(request: Request):
    # Read tokens from cookies (per-browser/session)
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    # If expired, try to refresh using refresh_token cookie
    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        # Attempt token refresh
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

        # Build a response that redirects to the same endpoint to continue flow with new cookie
        resp = RedirectResponse(url="/api/playlists")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        # spotify may not return a refresh_token on refresh; preserve existing one
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
    """Return the current user's top artists.

    Query params:
    - time_range: short_term | medium_term | long_term
    - limit: number of artists to return (max 50)
    """
    # Read tokens from cookies (per-browser/session)
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    # If expired, try to refresh using refresh_token cookie
    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        # Attempt token refresh
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

        # Build a response that redirects to the same endpoint to continue flow with new cookie
        resp = RedirectResponse(url=f"/api/top-artists?time_range={urllib.parse.quote(time_range)}&limit={int(limit)}")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        # spotify may not return a refresh_token on refresh; preserve existing one
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
    """Return the current user's Spotify profile.

    Uses the same cookie-based access/refresh token handling as other endpoints.
    """
    access_token = request.cookies.get("access_token")
    refresh_token = request.cookies.get("refresh_token")
    expires_at_raw = request.cookies.get("expires_at")

    if not access_token:
        return RedirectResponse(url="/api/auth/login")

    try:
        expires_at = float(expires_at_raw) if expires_at_raw else 0
    except Exception:
        expires_at = 0

    # If expired, try to refresh using refresh_token cookie
    if datetime.now().timestamp() > expires_at:
        if not refresh_token:
            return RedirectResponse(url="/api/auth/login")

        # Attempt token refresh
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

        # Build a response that redirects to the same endpoint to continue flow with new cookie
        resp = RedirectResponse(url="/api/me")
        resp.set_cookie("access_token", access_token or "", httponly=True, samesite="lax")
        # spotify may not return a refresh_token on refresh; preserve existing one
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