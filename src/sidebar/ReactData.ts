import { getCurrentColorKind } from '../extension';
import { getItem } from '../managers/FileManager';
import { getCachedPlaylistTracks, getSpotifyPlaylists, getSelectedPlaylistId } from '../managers/PlaylistManager';
import { getSlackWorkspaces, hasSlackWorkspaces } from '../managers/SlackManager';
import { getConnectedSpotifyUser } from '../managers/SpotifyManager';

export async function getReactData() {
  const name = getItem("name");
  const authType = getItem("authType");

  const spotifyPlaylists = await getSpotifyPlaylists();
  return {
    authType,
    registered: !!name,
    email: name,
    spotifyPlaylists,
    selectedPlaylistId: getSelectedPlaylistId(),
    playlistTracks: getCachedPlaylistTracks(),
    spotifyUser: getConnectedSpotifyUser(),
    slackConnected: !!hasSlackWorkspaces(),
    slackWorkspaces: getSlackWorkspaces(),
    currentColorKind: getCurrentColorKind(),
    skipSlackConnect: getItem("vscode_CtskipSlackConnect"),
  };
}
