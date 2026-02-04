from pydantic import BaseModel

class PromptRequest(BaseModel):
    prompt: str

class ChatHistoryItem(BaseModel):
    role: str
    parts: list[str]

class ChatRequest(BaseModel):
    message: str
    history: list[ChatHistoryItem] = []