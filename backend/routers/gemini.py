from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types
import urllib.request
import urllib.error
import json
from models import ChatRequest, ChatHistoryItem
import os

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemma-3-12b-it"
MCP_AGENT_URL = "http://127.0.0.1:8080"

router = APIRouter()

client = genai.Client(api_key=GEMINI_API_KEY)

@router.get("/agent-session")
async def create_agent_session(request: Request):
    agent_url = f"{MCP_AGENT_URL}/apps/agent/users/test_user/sessions/test_session"
    try:
        req = urllib.request.Request(
            agent_url,
            data=b"", 
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            body_text = resp.read().decode("utf-8")
        
        if status == 409:
            # Delete existing session
            req = urllib.request.Request(
                agent_url,
                data=b"",
                headers={"Content-Type": "application/json"},
                method="DELETE",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read() # Consume response
            
            # Re-create
            req = urllib.request.Request(
                agent_url,
                data=b"",
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                body_text = resp.read().decode("utf-8")

        try:
            result = json.loads(body_text)
        except Exception:
            result = {"raw": body_text}

        return JSONResponse(result)
    except urllib.error.HTTPError as he:
        body_text = he.read().decode("utf-8") if hasattr(he, "read") else str(he)
        raise HTTPException(status_code=502, detail=f"MCP server error: {body_text}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to contact MCP server: {e}")

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        chat_contents = [{"text": request.message}]
        
        url = f"{MCP_AGENT_URL}/run"

        payload = {
            "appName": "agent",
            "userId": "test_user",
            "sessionId": "test_session",
            "newMessage": {
                "role": "user",
                "parts": chat_contents
            }
        }
        req_body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=req_body,
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(len(req_body)),
            },
            method="POST",
        )
        
        extracted_id = None
        user_text = ""
        
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            resp_text = response.read().decode("utf-8")
            data = json.loads(resp_text)
            
            last_message = data[-1]
            if len(data) > 2:
                last_tool = data[-2]
                try:
                    tool = last_tool['content']['parts'][0]['functionResponse']
                    if tool['name'] == "create_playlist_from_queries":
                        extracted_id = tool['response']['playlist_id']
                except (KeyError, IndexError, TypeError):
                    pass
            
            user_text = last_message['content']['parts'][0]['text']

        if status < 200 or status >= 300:
            raise HTTPException(status_code=502, detail=f"Error {status}: {resp_text}")

        updated_history = request.history + [
            ChatHistoryItem(role="user", parts=[request.message]),
            ChatHistoryItem(role="model", parts=[user_text])
        ]

        return {
            "text": user_text,
            "playlist_id": extracted_id,  
            "history": updated_history
        }

    except Exception as e:
        print(f"Chat Error: {e}") 
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.get("/models")
def get_models():
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