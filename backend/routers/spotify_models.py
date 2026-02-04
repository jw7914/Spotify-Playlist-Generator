from pydantic import BaseModel

class CreatePlaylistRequest(BaseModel):
    name: str
    description: str = ""
    public: bool = False

class AddTracksRequest(BaseModel):
    uris: list[str]