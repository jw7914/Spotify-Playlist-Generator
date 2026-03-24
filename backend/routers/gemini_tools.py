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
delete_proposed_playlist = {
    "name": "deleteProposedPlaylist",
    "description": "Call this when the user rejects or wants to discard the currently proposed playlist (e.g. said 'no', 'never mind', 'cancel it', 'delete it'). Clears the cached proposal from the last proposePlaylist call. Do not call this if no proposal exists.",
    "parameters": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

add_tracks_to_proposal = {
    "name": "addTracksToProposal",
    "description": "Call this to add more tracks to the currently proposed playlist. Provide a list of track search queries. Do not call this if no proposal exists.",
    "parameters": {
        "type": "object",
        "properties": {
            "tracks": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of track search queries to add (e.g. 'Blinding Lights', 'The Weeknd - Save Your Tears')."
            }
        },
        "required": ["tracks"]
    }
}

remove_tracks_from_proposal = {
    "name": "removeTracksFromProposal",
    "description": "Call this to remove specific tracks from the currently proposed playlist. Provide a list of track names to remove. Do not call this if no proposal exists.",
    "parameters": {
        "type": "object",
        "properties": {
            "track_names": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of track names exactly as they appear in the proposal to remove."
            }
        },
        "required": ["track_names"]
    }
}