# Backify
Backup and Restore your Spotify Playlists and "Liked Songs".

This javascript based app allows you to backup all your playlists and import them in any other Spotify Account. It uses the OAuth-Functionality of Spotify to be able to handle your personal playlists. 

In consequence, no credentials or data is stored or processed on the Webserver itself.

You can use it at https://azhinu.github.io/backify/ or on your own webserver.

## Deploy on own server
Instructions assumed that you already have a webserver (nginx, Caddy, etc.).
1. Clone this repository.
2. Setup Spotify application at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications).
3. Edit `config.json` with your own client id and redirect uri.
4. Done.

## [Q&A](wiki)

## Credits
This is fork of [Backify](https://gitlab.com/StongLory/backify) based on [My Spot Backup](https://github.com/secuvera/SpotMyBackup)
