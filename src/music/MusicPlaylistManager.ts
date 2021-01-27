import { window, commands } from "vscode";
import {
    CodyResponse,
    CodyResponseType,
    addTracksToPlaylist,
    createPlaylist,
    PlaylistItem,
    getSpotifyLikedSongs
} from "cody-music";
import { OK_LABEL, SPOTIFY_LIKED_SONGS_PLAYLIST_NAME } from "../Constants";
import { getCodyErrorMessage } from "../Util";
import {
    populateSpotifyPlaylists
} from "../DataController";
import { MusicDataManager } from "./MusicDataManager";

export class MusicPlaylistManager {
    private static instance: MusicPlaylistManager;

    private constructor() {
        //
    }

    static getInstance(): MusicPlaylistManager {
        if (!MusicPlaylistManager.instance) {
            MusicPlaylistManager.instance = new MusicPlaylistManager();
        }

        return MusicPlaylistManager.instance;
    }

    async createPlaylist(
        playlistName: string,
        playlistTrackItems: PlaylistItem[]
    ) {
        // create the playlist
        const playlistResult: CodyResponse = await createPlaylist(
            playlistName,
            true
        );

        let playlistId = null;
        const errMsg = getCodyErrorMessage(playlistResult);
        if (errMsg) {
            window.showErrorMessage(
                `There was an unexpected error adding tracks to the playlist. ${errMsg} Refresh the playlist and try again if you feel the problem has been resolved.`,
                ...[OK_LABEL]
            );
            return;
        }
        // successfully created it
        playlistId = playlistResult.data.id;

        // create the tracks to add list
        const tracksToAdd: string[] = playlistTrackItems.map(
            (item: PlaylistItem) => {
                if (item.uri) {
                    return item.uri;
                }
                return item.id;
            }
        );

        this.addTracks(playlistId, playlistName, tracksToAdd);
    }

    async addTracks(playlist_id: string, name: string, tracksToAdd: string[]) {
        if (playlist_id) {
            // create the playlist_id in software
            const addTracksResult: CodyResponse = await addTracksToPlaylist(
                playlist_id,
                tracksToAdd
            );

            if (addTracksResult.state === CodyResponseType.Success) {
                window.showInformationMessage(
                    `Successfully created ${name} and added tracks.`
                );
                setTimeout(async () => {
                    // repopulate the playlists
                    if (playlist_id === SPOTIFY_LIKED_SONGS_PLAYLIST_NAME) {
                        MusicDataManager.getInstance().spotifyLikedSongs = await getSpotifyLikedSongs();
                    } else {
                        await populateSpotifyPlaylists();
                    }
                    commands.executeCommand("musictime.refreshPlaylist");
                }, 1000);
            } else {
                window.showErrorMessage(
                    `There was an unexpected error adding tracks to the playlist. ${addTracksResult.message}`,
                    ...[OK_LABEL]
                );
            }
        }
    }
}
