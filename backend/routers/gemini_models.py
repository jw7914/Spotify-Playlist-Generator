from pydantic import BaseModel

class PromptRequest(BaseModel):
    prompt: str

class ChatHistoryItem(BaseModel):
    role: str
    parts: list[str]

class ChatRequest(BaseModel):
    message: str
    history: list[ChatHistoryItem] = []
    session_id: str | None = None

class CreateSessionRequest(BaseModel):
    user_id: str
    title: str | None = None

class SessionResponse(BaseModel):
    id: str
    user_id: str
    title: str | None
    created_at: str
    updated_at: str

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str