from fastapi import APIRouter, HTTPException, Request
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
from backend.routers.gemini_models import ChatRequest, ChatHistoryItem, CreateSessionRequest, SessionResponse, MessageResponse
from backend.supabase import supabase
from datetime import datetime
from backend.routers.gemini_tools import *
from backend.routers.spotify import (
    create_playlist,
    search_spotify_songs,
    add_tracks_to_playlist
)
import redis
import json

load_dotenv()
router = APIRouter()
redis_url = os.environ.get("REDIS_URL_UPSTASH")
r = redis.Redis.from_url(redis_url)

def get_session(user_id):  
    data = r.get(user_id)
    if data:
        return json.loads(data)
    return {
        "awaiting_confirmation": False,
        "pending_playlist": None,
    }

def save_session(user_id, session):
    r.set(user_id, json.dumps(session), ex=3600)  # expires in 1 hour
# Initialize Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found. API calls will fail.")

try:
    client = genai.Client(api_key=GEMINI_API_KEY or "dummy_key")
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")
    client = None

GEMINI_MODEL = "gemini-2.5-flash"

def check_api_key():
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found in environment variables. Please add it to backend/.env")

# --- Session Management ---

@router.post("/sessions", response_model=SessionResponse)
def create_session(body: CreateSessionRequest):
    try:
        data = {
            "user_id": body.user_id,
            "title": body.title or "New Chat"
        }
        response = supabase.table("chat_sessions").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create session")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=list[SessionResponse])
def get_sessions(user_id: str):
    try:
        response = supabase.table("chat_sessions").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def get_session_messages(session_id: str):
    try:
        response = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    try:
        # Delete messages first (cascade should handle this if configured, but explicit is safer)
        supabase.table("chat_messages").delete().eq("session_id", session_id).execute()
        # Delete session
        response = supabase.table("chat_sessions").delete().eq("id", session_id).execute()
        if not response.data:
             # It might be that the session didn't exist or was already deleted
             return {"message": "Session not found or already deleted"}
        return {"message": "Session deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Chat ---

@router.post("/chat")
async def chat_endpoint(req: Request, request: ChatRequest):
    check_api_key()
    try:
        # 1. Create session if provided session_id doesn't exist or is None? 
        # Actually, if session_id is None, we should probably create one or just treat as ephemeral.
        # But for history, we want to save it.
        # Let's assume if session_id is provided, we use it. If not, we don't save to DB (or the frontend should create one first).
        # Better: If session_id is provided, save.
        
        session_id = request.session_id #chat session 
        session_state = get_session(session_id)

        # Optimize history for Gemini
        formatted_history = []
        for item in request.history:
            formatted_history.append(types.Content(
                role=item.role,
                parts=[types.Part.from_text(text=part) for part in item.parts]
            ))

        chat = client.chats.create(
            model=GEMINI_MODEL,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are a Spotify AI DJ. Your goal is to help users build playlists based on their feelings, moods, or described scenarios.\n\n"
                    "When a user describes a scenario or asks for a playlist:\n"
                    "1. Call proposePlaylist with a name, optional description, and a list of track search queries (e.g. song titles or 'artist - song'). "
                    "Do not call createPlaylist or addTracksToPlaylist directly.\n"
                    "2. The backend will search Spotify for each query, cache the track IDs, and show the user a structured proposal with the actual tracks found (name and artists).\n"
                    "3. When the user confirms they want it (e.g. 'yes', 'create it', 'sounds good', 'go ahead'), you must call confirmAndCreatePlaylist. "
                    "That uses the cached proposal—do not call proposePlaylist again. If the user declines (e.g. 'no', 'cancel'), respond in chat that you won't create it; do not call any tool."
                ),
                tools=[
                    {
                        "function_declarations": [
                            propose_playlist,
                            confirm_and_create_playlist,
                        ]
                    }
                ],
            ),
            history=formatted_history
        )
        response = chat.send_message(request.message)

        # Check for function call
        if response.candidates[0].content.parts and \
        response.candidates[0].content.parts[0].function_call:

            function_call = response.candidates[0].content.parts[0].function_call
            function_name = function_call.name
            print("func name", function_name)
            args = dict(function_call.args)

            # -------------------------
            # PHASE 1: Proposal Phase
            # -------------------------
            
            if function_name == "proposePlaylist":
                # Search Spotify for each track first; cache track IDs in Redis
                track_ids = []
                tracks_display = []
                for query in args.get("tracks") or []:
                    try:
                        result = search_spotify_songs(
                            query=query,
                            type="track",
                            limit=1,
                        )
                        items = (result.get("tracks") or {}).get("items") or []
                        if items:
                            t = items[0]
                            track_ids.append(t["id"])
                            artists = ", ".join(a["name"] for a in t.get("artists") or [])
                            tracks_display.append({"name": t.get("name", query), "artists": artists})
                        else:
                            tracks_display.append({"name": query, "artists": "(not found)"})
                    except Exception:
                        tracks_display.append({"name": query, "artists": "(search failed)"})

                session_state["pending_playlist"] = {
                    "name": args.get("name", "New Playlist"),
                    "description": args.get("description") or "",
                    "track_ids": track_ids,
                    "tracks_display": tracks_display,
                }
                session_state["awaiting_confirmation"] = True
                save_session(session_id, session_state)

                lines = [
                    "Here's the playlist I propose (from Spotify search):",
                    "",
                    f"**Name:** {session_state['pending_playlist']['name']}",
                    f"**Description:** {session_state['pending_playlist']['description'] or 'None'}",
                    "**Tracks:**",
                ]
                for i, d in enumerate(tracks_display, start=1):
                    lines.append(f"  {i}. {d['name']} — {d['artists']}")
                lines.append("")
                lines.append("Would you like me to create this playlist?")
                user_text = "\n".join(lines)

            # -------------------------
            # Confirmation: Gemini infers and calls confirmAndCreatePlaylist
            # -------------------------
            elif function_name == "confirmAndCreatePlaylist" and session_state.get("pending_playlist"):
                proposal = session_state["pending_playlist"]
                track_ids = proposal.get("track_ids") or []
                try:
                    playlist = create_playlist(
                        name=proposal["name"],
                        description=proposal.get("description"),
                        public=False,
                        request=req,
                    )
                    if track_ids:
                        add_tracks_to_playlist(
                            playlist_id=playlist["id"],
                            track_ids=track_ids,
                            request=req,
                        )
                    session_state["awaiting_confirmation"] = False
                    session_state["pending_playlist"] = None
                    save_session(session_id, session_state)
                    ext = (playlist.get("external_urls") or {}).get("spotify", "")
                    user_text = (
                        f'Playlist "{playlist["name"]}" created successfully.\n'
                        f'Added {len(track_ids)} tracks.\n'
                        + (f'View on Spotify: {ext}' if ext else '')
                    )
                except Exception as e:
                    user_text = f"Something went wrong creating the playlist: {e}"

            elif function_name == "confirmAndCreatePlaylist" and not session_state.get("pending_playlist"):
                user_text = "There's no pending playlist to create. Ask me to propose one first, then confirm when you're ready."

            elif function_name == "createPlaylist" and session_state.get("pending_playlist"):
                proposal = session_state["pending_playlist"]
                track_ids = proposal.get("track_ids") or []
                playlist = create_playlist(
                    name=proposal["name"],
                    description=proposal.get("description"),
                    public=False,
                    request=req,
                )

                # 2️⃣ Add tracks using cached track IDs from Redis (no search)
                if track_ids:
                    add_tracks_to_playlist(
                        playlist_id=playlist["id"],
                        track_ids=track_ids,
                        request=req,
                    )


       

                # Clear session and persist to Redis
                session_state["awaiting_confirmation"] = False
                session_state["pending_playlist"] = None
                save_session(session_id, session_state)

                ext = (playlist.get("external_urls") or {}).get("spotify", "")
                user_text = (
                    f'Playlist "{playlist["name"]}" created successfully.\n'
                    f'Added {len(track_ids)} tracks.\n'
                    + (f'View on Spotify: {ext}' if ext else '')
                )
        # -------------------------
        # Normal Text Response
        # -------------------------
        else:
            user_text = response.text


        
        # Update history (Frontend expects this)
        updated_history = request.history + [
            ChatHistoryItem(role="user", parts=[request.message]),
            ChatHistoryItem(role="model", parts=[user_text])
        ]
        
        # Save to Supabase if session_id is present
        if session_id:
            try:
                # Save user message
                supabase.table("chat_messages").insert({
                    "session_id": session_id,
                    "role": "user",
                    "content": request.message
                }).execute()
                
                # Save model message
                supabase.table("chat_messages").insert({
                    "session_id": session_id,
                    "role": "model",
                    "content": user_text
                }).execute()
                
                # Update session updated_at
                supabase.table("chat_sessions").update({
                    "updated_at": datetime.now().isoformat()
                }).eq("id", session_id).execute()
                
            except Exception as e:
                print(f"Failed to save chat history: {e}")
                # Don't fail the request, just log error

        return {
            "text": user_text,
            "history": updated_history
        }

    except Exception as e:
        print(f"Chat Error: {e}") 
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.get("/models")
def get_models():
    check_api_key()
    try:
        models = []
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

@router.get("/test")
async def test_ai_connection(q: str):
    check_api_key()
    try:
        response = client.models.generate_content(
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