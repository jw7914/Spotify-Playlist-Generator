from pathlib import Path
from fastapi import FastAPI, APRouter, HTTPException, Cookie, Response
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse
import urllib.parse
import urllib.request
import urllib.error
import json
import base64
from dotenv import load_dotenv
import os
import secrets # Used for generating 'state'

# --- Configuration ---
load_dotenv()
API_BASE_URL = "https://api.spotify.com/v1"
TOKEN_URL = "https://accounts.spotify.com/api/token"
AUTH_URL = "https://accounts.spotify.com/authorize"

FRONTEND_DIST = (Path(__file__).parent.parent / "frontend" / "dist").resolve()

IS_PROD = os.getenv("APP_ENV") == "production"
COOKIE_SECURE = IS_PROD
COOKIE_SAMESITE = "none" if IS_PROD else "lax"

app = FastAPI(title="Spotify Playlist Generator")
api_router = APRouter(prefix="/api")

# --- Helper Functions ---

def get_redirect_uri():
    """Gets the correct redirect URI based on environment."""
    # Matches the logic in your TS files
    uri = (
        os.getenv("REDIRECT_URI") or
        "http://127.0.0.1:8000/api/auth/callback"
    )
    if not uri:
        raise HTTPException(status_code=500, detail="Missing SPOTIFY_REDIRECT_URI env vars")
    return uri

def get_spotify_creds():
    """Gets client_id and client_secret or raises 500."""
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Missing Spotify client credentials on server")
    return client_id, client_secret

def set_token_cookies(
    response: Response,
    access_token: str,
    expires_in: int,
    refresh_token: str | None
):
    """Utility to set access and refresh token cookies on a response."""
    
    # Access token (short lived)
    response.set_cookie(
        "spotify_access_token",
        access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        max_age=expires_in
    )
    
    # Refresh token (longer lived)
    if refresh_token:
        response.set_cookie(
            "spotify_refresh_token",
            refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            path="/",
            max_age=60 * 60 * 24 * 30 # 30 days
        )

# --- API Routes ---

@api_router.get("/auth/login")
def login(response: Response):
    """
    Redirect to Spotify's authorization endpoint.
    Stores a 'state' value in an httpOnly cookie for CSRF protection.
    """
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    redirect_uri = get_redirect_uri()
    state = secrets.token_hex(16)
    
    scope = "user-read-private user-read-email user-top-read"
    params = {
        "client_id": client_id,
        "response_type": "code",
        "scope": scope,
        "redirect_uri": redirect_uri,
        "state": state,
        "show_dialog": True
    }
    auth_url = f"{AUTH_URL}?{urllib.parse.urlencode(params)}"
    
    # Set the state cookie for later verification
    response.set_cookie(
        "spotify_auth_state",
        state,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
        max_age=60 * 10 # 10 minutes
    )
    
    return RedirectResponse(url=auth_url)

@api_router.get("/auth/callback")
def callback(
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    spotify_auth_state: str | None = Cookie(None)
):
    """
    Callback route for Spotify OAuth.
    - Verifies 'state' cookie
    - Exchanges 'code' for tokens
    - Stores tokens in httpOnly cookies
    - Clears 'state' cookie
    - Redirects to '/'
    """
    if error:
        # User denied or Spotify error
        return RedirectResponse(url=f"/?error={urllib.parse.quote(error)}")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing 'code' or 'state' in callback query")

    # Verify state cookie
    if not spotify_auth_state or spotify_auth_state != state:
        raise HTTPException(status_code=400, detail="state_mismatch")

    client_id, client_secret = get_spotify_creds()
    redirect_uri = get_redirect_uri()

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
    req = urllib.request.Request(TOKEN_URL, data=encoded, headers=headers, method="POST")
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

    # Redirect to home (like callback_route.ts)
    res = RedirectResponse(url="/")
    
    # Set token cookies
    set_token_cookies(
        res,
        access_token=token_data["access_token"],
        expires_in=token_data.get("expires_in", 3600),
        refresh_token=token_data.get("refresh_token")
    )
    
    # Clear the temporary state cookie
    res.set_cookie(
        "spotify_auth_state",
        "",
        max_age=0,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE
    )
    
    return res

@api_router.post("/auth/refresh")
def refresh_token(
    response: Response,
    spotify_refresh_token: str | None = Cookie(None)
):
    """
    Uses the refresh_token (from cookie) to get a new access_token.
    Sets the new access_token in its cookie.
    """
    if not spotify_refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    client_id, client_secret = get_spotify_creds()

    data = {
        "grant_type": "refresh_token",
        "refresh_token": spotify_refresh_token,
    }
    auth_value = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_value}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    encoded = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(TOKEN_URL, data=encoded, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body_text = resp.read().decode("utf-8")
            token_data = json.loads(body_text)
    except Exception as e:
        # If refresh fails, client must re-authenticate
        # Clear bad refresh token
        response = JSONResponse(status_code=401, content={"error": "Refresh failed"})
        response.set_cookie("spotify_refresh_token", "", max_age=0, path="/")
        response.set_cookie("spotify_access_token", "", max_age=0, path="/")
        return response

    # Set the new tokens
    set_token_cookies(
        response,
        access_token=token_data["access_token"],
        expires_in=token_data.get("expires_in", 3600),
        # Spotify *may* return a new refresh token
        refresh_token=token_data.get("refresh_token") 
    )
    return {"status": "success", "access_token": token_data["access_token"]}


@api_router.get("/playlists")
def get_playlists(spotify_access_token: str | None = Cookie(None)):
    """
    Fetches user's playlists using the access token from the cookie.
    """
    if not spotify_access_token:
        # No token, user must login
        return RedirectResponse(url="/api/auth/login")
    
    headers = {
        "Authorization": f"Bearer {spotify_access_token}"
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
            if he.code == 401:
                # Token expired or invalid.
                # In a real app, the frontend would see this 401
                # (or redirect) and call /api/auth/refresh.
                # For simplicity, just redirect to login.
                return RedirectResponse(url="/api/auth/login")
            body = he.read().decode("utf-8") if hasattr(he, "read") else ""
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

# --- Static Frontend Serving ---
# This part remains the same

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