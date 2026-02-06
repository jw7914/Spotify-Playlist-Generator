from pydantic import BaseModel

class CreatePlaylistRequest(BaseModel):
    name: str
    description: str
    public: bool

class AddTracksRequest(BaseModel):
    uris: list[str]

class UploadImageRequest(BaseModel):
    image: str