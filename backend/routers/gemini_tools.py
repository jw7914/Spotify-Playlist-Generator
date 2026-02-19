propose_playlist = {
    "name": "proposePlaylist",
    "description": "Propose a playlist by searching Spotify for each track. Call this with a name, optional description, and a list of track search queries (e.g. song titles or 'artist - song'). The backend will search for each, cache the track IDs, and show the user the actual tracks found. After user confirms, the playlist is created and tracks are added using the cached IDs.",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the playlist"
            },
            "description": {
                "type": "string",
                "description": "Optional description of the playlist"
            },
            "tracks": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of track search queries (e.g. 'Blinding Lights', 'The Weeknd - Save Your Tears'). Each will be searched on Spotify; first result is used."
            }
        },
        "required": ["name", "tracks"]
    }
}

confirm_and_create_playlist = {
    "name": "confirmAndCreatePlaylist",
    "description": "Call this when the user has confirmed they want the proposed playlist created (e.g. said 'yes', 'create it', 'sounds good'). Uses the cached proposal from the last proposePlaylist call. Do not call this before the user has seen a proposal and agreed.",
    "parameters": {
        "type": "object",
        "properties": {},
        "required": []
    }
}