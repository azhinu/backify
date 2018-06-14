let spotifyConfig;

let authWindow = null;
let token = null;
let collections = {};
let importColl = {};
let userId;
let email;

let isImporting = false;
let isExporting = false;
let globalStep = "";
let playlistStep = 0;
let playlistTotal = 0;
let trackStep = 0;
let trackTotal = 0;
let artistStep = 0;
let artistTotal = 0;

let playlistQueue = [];
let savedQueue = [];

let makingChanges = false;

function init() {
    // Disables login button to wait for config to load
    toggleLoginButton();
    // Loads config.json file using XHR
    // This file contains configuration values specific for Spotify API such as client_id or redirect_uri
    loadConfig(function () {
        window.addEventListener("message", authCallback, false);
        bindControls();
        refreshProgress();
        toggleLoginButton();
    });
}

function toggleLoginButton() {
    $('#login').prop('disabled', function (i, v) {
        return !v;
    });
}

function toggleExportButton() {
    $('#btnExport').prop('disabled', function (i, v) {
        return !v;
    });
}

function loadFile() {
    $('#fileImport').trigger('click');
}

function loadConfig(callback) {
    XHR('config.json', function (response) {
        spotifyConfig = JSON.parse(response).spotifyConfig;
        callback();
    });
}

function bindControls() {
    $('#login').click(login);
    $('#btnImport').click(loadFile);
    $('#btnExport').click(download);
    $('#btnReset').click(resetApp);
    $('#fileImport').change(readFile);
}

function handleAuth(accessToken) {
    token = accessToken;
    $.ajax({
        url: 'https://api.spotify.com/v1/me',
        headers: {
            'Authorization': 'Bearer ' + accessToken
        },
        success: function (response) {
            userId = response.id.toLowerCase();
            email = response.email.toLowerCase();

            $('#userName').html(email);
            $('#pnlLoggedOut').hide();

            refreshTrackData(function () {
                // Check for all the data read
                // If user has no music/artists in account disable export button
                if (isEmpty(collections.playlists) &&
                    isEmpty(collections.saved) &&
                    isEmpty(collections.artists)) {
                    toggleExportButton();
                }
                $('#pnlAction').show();
            });
        }
    });
}

function refreshTrackData(callback) {
    if (!isExporting && !isImporting) {
        isExporting = true;
        resetCounter();
        $('#pnlLoadingAccount').show();
        $('#loadingTitle').html('Please wait. Loading your followed artists ...');
        refreshFollowedArtists(function () {
            $('#loadingTitle').html('Please wait. Loading your playlists ...');
            refreshPlaylist(function () {
                $('#loadingTitle').html('Please wait. Loading your tracks ...');
                refreshMyMusicTracks(function () {
                    $('#loadingTitle').html('Finished loading, you now might want to export or import.');
                    isExporting = false;
                    callback();
                });
            });
        });
    }
}

function resetApp() {
    resetCounter();
    resetVariables();
    resetUI();
}

function resetCounter() {
    globalStep = '';
    playlistStep = 0;
    playlistTotal = 0;
    trackStep = 0;
    trackTotal = 0;
    artistStep = 0;
    artistTotal = 0;
}

function resetVariables() {
    isImporting = false;
    isExporting = false;
    makingChanges = false;
    playlistQueue = [];
    savedQueue = [];
    collections = {};
    importColl = {};
    authWindow = null;
    token = null;
    userId = null;
    email = null;
}

function resetUI() {
    $('#pnlLoadingAccount').hide();
    $('#pnlAction').hide();
    $('#pnlFileInfo').hide();
    $('#pnlUpload').hide();
    $('#pnlLoggedOut').show();
}

function refreshProgress() {
    $('#globalStep').html(globalStep);
    $('#playlistStep').html(playlistStep);
    $('#playlistTotal').html(playlistTotal);
    $('#trackStep').html(trackStep);
    $('#trackTotal').html(trackTotal);
    $('#artistStep').html(artistStep);
    $('#artistTotal').html(artistTotal);
    let progress = 0;
    if (artistTotal > 0) {
        progress = Math.floor(((artistStep / artistTotal) * 100));
    }
    if (trackTotal > 0) {
        progress = Math.floor((progress * Math.floor(((trackStep / trackTotal) * 100))) / 100);
    }
    $('#progressBar').css('width', progress + '%');
    if (typeof collections !== 'undefined' && !makingChanges) {
        let set = collectionProperties(collections);
        $('#loadingPlaylists').html("" + set.playlistCount + " playlists");
        $('#loadingTracks').html("" + set.trackCount + " tracks");
        $('#loadingArtists').html("" + set.artistCount + " artists");
    }
    if (typeof importColl !== 'undefined') {
        let set2 = collectionProperties(importColl);
        $('#filePlaylists').html("" + set2.playlistCount + " playlists");
        $('#fileTracks').html("" + set2.trackCount + " tracks");
        $('#fileArtists').html("" + set2.artistCount + " artists");

    }
    setTimeout(refreshProgress, 100);
}

function login() {
    let width = 480, height = 640;
    let left = (screen.width / 2) - (width / 2);
    let top = (screen.height / 2) - (height / 2);

    let set = {
        client_id: spotifyConfig.client_id,
        redirect_uri: spotifyConfig.redirect_uri,
        scope: spotifyConfig.scope,
        response_type: spotifyConfig.response_type,
        show_dialog: spotifyConfig.show_dialog
    };
    authWindow = window.open(
        "https://accounts.spotify.com/authorize?" + urlEncodeSet(set),
        "Spotify",
        'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
    );
}

function authCallback(event) {
    if (event.origin !== spotifyConfig.uri) {
        return;
    }
    if (authWindow) {
        authWindow.close();
    }
    if (event.data) {
        handleAuth(event.data);
    }
}

function urlEncodeSet(set) {
    let comps = [];
    for (let i in set) {
        if (set.hasOwnProperty(i)) {
            comps.push(encodeURIComponent(i) + "=" + encodeURIComponent(set[i]));
        }
    }
    return comps.join("&");
}

function download() {
    let json = JSON.stringify(collections);
    let d = new Date();
    let time = '@' + d.getFullYear() + '_' + (d.getMonth() + 1) + '_' + d.getDate();
    let emailWithoutDomain = email.substring(0, email.lastIndexOf("@"));
    let filename = emailWithoutDomain + time + '.json';
    let pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        let event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }
}

function readFile(evt) {
    //Retrieve the first (and only!) File from the FileList object
    let f = evt.target.files[0];

    if (f) {
        let r = new FileReader();
        r.onload = function (e) {
            let json = e.target.result;

            importColl = validateJSON(json);

            if (!importColl) {
                alert("This file is not a valid JSON file. Try again.");
                return;
            }

            $('#fileName').html(f.name);
            $('#pnlAction').hide();
            $('#pnlFileInfo').show();
            $('#pnlUpload').show();

            compareEverything();
        };
        r.readAsText(f);
    } else {
        alert("Failed to load file");
    }
}

function collectionProperties(coll) {
    return {
        artistCount: collArtistCount(coll),
        playlistCount: collPlaylistCount(coll),
        trackCount: collTrackCount(coll)
    };
}

function collTrackCount(coll) {
    let count = 0;

    if (!coll) {
        return count;
    }

    let keys = _.keys(coll.playlists);
    $.each(keys, function (index, value) {
        count += coll.playlists[value].tracks.length;
    });
    if (coll.saved) {
        count += coll.saved.length;
    }
    return count;
}

function collPlaylistCount(coll) {
    if (!coll) {
        return 0;
    }
    let keys = _.keys(coll.playlists);
    return keys.length;
}

function collArtistCount(coll) {
    if (!coll) {
        return 0;
    }
    let keys = _.keys(coll.artists);
    return keys.length;
}

function compareEverything() {
    if (!isImporting && !isExporting) {
        isImporting = true;
        makingChanges = true;
        resetCounter();

        savedQueue = [];
        playlistQueue = [];
        artistQueue = [];

        globalStep = "Uploading";
        if (typeof importColl !== 'undefined') {

            playlistTotal = collPlaylistCount(importColl);

            // compare artists
            globalStep = "Comparing artists";
            compareArtists(importColl.artists, collections.artists, addToFollowing);

            // compare saved
            globalStep = "Comparing saved tracks";
            compareIdTracks(importColl.saved, collections.saved, addToSaved);

            // compare playlists
            let playlistNames = _.keys(importColl.playlists);
            globalStep = "Comparing playlists";
            handlePlaylistCompare(playlistNames.reverse(), function () {
                handleUpload();
            });
        }
    }
}

function handleUpload() {

    // calculate track differences
    trackDiff = savedQueue.length + playlistQueue.length;
    trackTotal = Math.max(collTrackCount(importColl), trackDiff);
    trackStep = trackTotal - trackDiff;
    // calculate artist differences
    artistTotal = Math.max(collArtistCount(importColl), artistQueue.length);
    artistStep = artistTotal - artistQueue.length;

    if (artistTotal === 0 || trackTotal === 0) {
        globalStep = "No new tracks or artists found in import";
    } else {
        if (artistTotal > 0) {
            $('#progressBar').show();
            globalStep = "Following artists";
            handleArtistRequests(artistQueue.reverse(), function () {
                globalStep = "Finished following artists";
                artistTotal = artistStep;
            })
        }

        if (trackTotal > 0) {
            $('#progressBar').show();
            globalStep = "Uploading tracks";
            handleSavedRequests(savedQueue.reverse(), function () {
                handlePlaylistRequests(playlistQueue.reverse(), function () {
                    globalStep = "Finished everything";
                    trackTotal = trackStep;
                });
            });
        }
    }

    isImporting = false;

}

function handlePlaylistCompare(names, callback) {

    if (!names) {
        callback();
    }

    let name = names.pop();
    if (!name) {
        callback();
        return;
    }
    makeSurePlaylistExists(name, function (proceed) {
        if (proceed) {
            let playlistId = collections.playlists[name].id;
            compareUriTracks(importColl.playlists[name].tracks, collections.playlists[name].tracks, function (uri) {
                addToPlaylist(playlistId, uri);
            });
        }
        handlePlaylistCompare(names, callback);
    });
}

function addToPlaylist(playlistId, trackUri) {
    playlistQueue.push('https://api.spotify.com/v1/users/' + userId + '/playlists/' + playlistId + '/tracks?uris=' + encodeURIComponent(trackUri));
}

function makeSurePlaylistExists(name, callback) {
    playlistStep += 1;
    if (name in collections.playlists) {
        callback(true);
        return;
    }
    let set = {name: name, public: "true"};
    $.ajax({
        method: "POST",
        url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
        data: JSON.stringify(set),
        contentType: 'application/json',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function (response) {
            collections.playlists[name] = {
                name: name,
                href: response.tracks.href,
                id: response.id,
                tracks: []
            };
            callback(true);
        },
        fail: function () {
            callback(false);
        }
    });
}

function handleArtistRequests(arr, callback) {
    let url = arr.pop();
    if (url) {
        artistStep += 1;
        $.ajax({
            method: "PUT",
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function () {
            },
            fail: function (jqXHR, textStatus, errorThrown) {
                console.log(errorThrown);
            }
        })
            .always(function () {
                handleArtistRequests(arr, callback);
            });
    } else {
        callback();
    }
}

function handleSavedRequests(arr, callback) {
    let url = arr.pop();
    if (url) {
        trackStep += 1;
        $.ajax({
            method: "PUT",
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function () {
            },
            fail: function (jqXHR, textStatus, errorThrown) {
                console.log(errorThrown);
            }
        })
            .always(function () {
                handleSavedRequests(arr, callback);
            });
    } else {
        callback();
    }
}

function handlePlaylistRequestsWithTimeout(arr, callback, timeout) {
    setTimeout(function () {
        handlePlaylistRequests(arr, callback)
    }, timeout);
}

function handlePlaylistRequests(arr, callback) {
    let url = arr.pop();
    if (url) {
        trackStep += 1;
        $.ajax({
            method: "POST",
            url: url,
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            fail: function (jqXHR, textStatus, errorThrown) {
                console.log('Track URI not found. Probably local file...');
            }
        })
            .always(function () {
                handlePlaylistRequestsWithTimeout(arr, callback, spotifyConfig.slowdown_import);
            })
    } else {
        callback();
    }
}

function addToSaved(id) {
    savedQueue.push('https://api.spotify.com/v1/me/tracks?ids=' + id);
}

function addToFollowing(id) {
    artistQueue.push('https://api.spotify.com/v1/me/following?type=artist&ids=' + id);
}

function compareUriTracks(imported, stored, addCallback) {
    $.each(imported, function (index, value) {
        let found = false;
        $.each(stored, function (index2, value2) {
            if (value.uri === value2.uri) {
                found = true;
            }
        });
        if (!found) {
            addCallback(value.uri);
        }
    });
}

function compareIdTracks(imported, stored, addCallback) {

    if (!imported) {
        return;
    }

    $.each(imported, function (index, value) {
        let found = false;
        $.each(stored, function (index2, value2) {
            if (value.id === value2.id) {
                found = true;
            }
        });
        if (!found) {
            addCallback(value.id);
        }
    });
}

function compareArtists(imported, stored, addCallback) {

    if (!imported) {
        return;
    }

    $.each(imported, function (index, value) {
        let found = false;
        $.each(stored, function (index2, value2) {
            if (value.id === value2.id) {
                found = true;
            }
        });
        if (!found) {
            addCallback(value.id);
        }
    });
}

function refreshMyMusicTracks(callback) {
    collections.saved = [];
    playlistStep += 1;
    loadTrackChunks('https://api.spotify.com/v1/me/tracks', collections.saved, callback);
}

function loadTrackChunksWithTimeout(url, arr, callback, timeout) {
    setTimeout(function () {
        loadTrackChunks(url, arr, callback)
    }, timeout);
}

function loadTrackChunks(url, arr, callback) {
    $.ajax({
        url: url,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function (data) {
            if (!data) return;
            if ('items' in data) {
                $.each(data.items, function (index, value) {
                    if (value.track !== null) {
                        arr.push({id: value.track.id, uri: value.track.uri});
                    } else {
                        console.log("track is null", value);
                    }
                });
            } else {
                arr.push({id: data.track.id, uri: data.track.uri});
            }
            if (data.next) {
                loadTrackChunksWithTimeout(data.next, arr, callback, spotifyConfig.slowdown_export);
            } else {
                callback();
            }
        }
    });
}

function refreshPlaylist(callback) {
    collections.playlists = {};
    let playlists = [];
    loadPlaylistChunks('https://api.spotify.com/v1/me/playlists', playlists, function () {
        handlePlaylistTracks(playlists, collections.playlists, callback);
    });
}

function loadPlaylistChunks(url, arr, callback) {
    $.ajax({
        url: url,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function (data) {
            if (!data) return;
            if ('items' in data) {
                $.each(data.items, function (index, value) {
                    if (value.tracks && value.tracks.href) {
                        arr.push({
                            name: value.name,
                            href: value.tracks.href,
                            id: value.id,
                            tracks: []
                        });
                    }
                });
            } else {
                if (data.tracks && data.tracks.href) {
                    arr.push({
                        name: data.name,
                        href: data.tracks.href,
                        id: value.id,
                        tracks: []
                    });
                }
            }
            if (data.next) {
                loadPlaylistChunks(data.next, arr, callback);
            } else {
                callback();
            }
        }
    });
}

function handlePlaylistTracks(arr, result, callback) {
    let item = arr.pop();
    if (!item) {
        return callback();
    }
    playlistStep += 1;
    item.tracks = [];
    loadTrackChunks(item.href, item.tracks, function () {
        delete item.href;
        result[item.name] = item;
        if (arr.length === 0) {
            callback();
        } else {
            handlePlaylistTracks(arr, result, callback);
        }
    });
}

function refreshFollowedArtists(callback) {
    collections.artists = [];
    loadArtistChunks('https://api.spotify.com/v1/me/following?type=artist', collections.artists, callback);
}

function loadArtistChunks(url, arr, callback) {
    $.ajax({
        url: url,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function (data) {
            if (!data.artists) return;
            if ('items' in data.artists) {
                $.each(data.artists.items, function (index, value) {
                    if (value.id !== null && value.uri !== null) {
                        arr.push({id: value.id, uri: value.uri});
                    } else {
                        console.log("artist is null", value);
                    }
                });
            } else {
                arr.push({id: data.artists.id, uri: data.artists.uri});
            }

            if (data.next) {
                loadArtistChunks(data.artists.next, arr, callback);
            } else {
                callback();
            }
        }
    });
}

window.onload = function () {
    if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
        // MSIE
        $('#pnlLoggedOut').html('Please use Firefox or Chrome, due to a bug in Internet Explorer');
    } else {
        init();
    }
};