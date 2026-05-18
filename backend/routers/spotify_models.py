from pydantic import BaseModel

class CreatePlaylistRequest(BaseModel):
    name: str
    description: str
    public: bool

class AddTracksRequest(BaseModel):
    uris: list[str]


class UpdatePlaylistRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    public: bool | None = None


class SaveIdsRequest(BaseModel):
    ids: list[str]


class TransferPlaybackRequest(BaseModel):
    device_id: str
    play: bool = False


class AddToQueueRequest(BaseModel):
    uri: str
    device_id: str | None = None


class SetPlaylistImageRequest(BaseModel):
    image_base64: str
