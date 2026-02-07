from fastapi import APIRouter, HTTPException, Request
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
from backend.routers.gemini_models import ChatRequest, ChatHistoryItem, CreateSessionRequest, SessionResponse, MessageResponse
from backend.supabase import supabase
from datetime import datetime

load_dotenv()
router = APIRouter()

# Initialize Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found. API calls will fail.")

try:
    client = genai.Client(api_key=GEMINI_API_KEY or "dummy_key")
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")
    client = None

GEMINI_MODEL = "gemini-flash-latest"

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
async def chat_endpoint(request: ChatRequest):
    check_api_key()
    try:
        # 1. Create session if provided session_id doesn't exist or is None? 
        # Actually, if session_id is None, we should probably create one or just treat as ephemeral.
        # But for history, we want to save it.
        # Let's assume if session_id is provided, we use it. If not, we don't save to DB (or the frontend should create one first).
        # Better: If session_id is provided, save.
        
        session_id = request.session_id
        
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
                system_instruction="You are a Spotify AI DJ. Your goal is to help users build playlists based on their feelings, moods, or described scenarios. When a user describes a scenario, suggest a list of songs or a playlist concept."
            ),
            history=formatted_history
        )

        response = chat.send_message(request.message)
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