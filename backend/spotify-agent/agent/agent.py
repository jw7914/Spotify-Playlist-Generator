from google.adk.agents.llm_agent import Agent
import os
import re
import requests


MCP_HTTP_BASE = os.environ.get('SPOTIFY_MCP_HTTP_URL', 'http://127.0.0.1:3030/tool')


def _call_tool(name: str, args: dict):
    url = f"{MCP_HTTP_BASE}/{name}"
    resp = requests.post(url, json=args, timeout=30)
    resp.raise_for_status()
    return resp.json()


def search_track(query: str, limit: int = 1):
    return _call_tool('searchSpotify', {'query': query, 'type': 'track', 'limit': limit})


def create_playlist(name: str, description: str | None = None, public: bool = False):
    return _call_tool('createPlaylist', {'name': name, 'description': description or '', 'public': public})


def add_tracks_to_playlist(playlist_id: str, track_ids: list[str]):
    return _call_tool('addTracksToPlaylist', {'playlistId': playlist_id, 'trackIds': track_ids})


def _extract_first_id_from_search(response_json: dict):
    # searchSpotify returns a text block; extract the first "ID: <id>"
    try:
        content = response_json.get('content', [])
        if not content:
            return None
        text = content[0].get('text', '')
        m = re.search(r"ID: ([A-Za-z0-9]+)", text)
        return m.group(1) if m else None
    except Exception:
        return None


def create_playlist_from_queries(name: str, queries: list[str], description: str | None = None, public: bool = False):
    """Create a playlist named `name` and add the first matching track for each query."""
    created = create_playlist(name, description, public)
    # created response includes Playlist ID in its text
    playlist_text = ''
    try:
        playlist_text = created.get('content', [])[0].get('text', '')
    except Exception:
        pass
    m = re.search(r"Playlist ID: ([A-Za-z0-9]+)", playlist_text)
    if not m:
        raise RuntimeError('Failed to determine created playlist ID')
    playlist_id = m.group(1)

    track_ids: list[str] = []
    for q in queries:
        res = search_track(q, 1)
        tid = _extract_first_id_from_search(res)
        if tid:
            track_ids.append(tid)

    if track_ids:
        add_tracks_to_playlist(playlist_id, track_ids)

    return {'playlist_id': playlist_id, 'added': len(track_ids)}


root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description='A helpful assistant for Spotify playlist creation.',
    instruction='You are a helpful assistant that helps the user creates Spotify playlists.',
)

# expose helper functions on the agent for convenience
root_agent.tools = [
    create_playlist_from_queries,
    search_track,
    create_playlist,
    add_tracks_to_playlist,
]