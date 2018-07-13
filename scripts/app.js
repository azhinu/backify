let spotifyConfig;

let authWindow = null;
let token = null;
let collections = {};
let importColl = {};
let userId;
let email;

let isImporting = false;
let isExporting = false;
let makingChanges = false;
let globalStep = "";
let playlistStep = 0;
let playlistTotal = 0;
let trackStep = 0;
let trackTotal = 0;
let artistStep = 0;
let artistTotal = 0;

/* API calls counter */
let tries = 0;

/* jQuery selectors */
let loginSelector;
let btnImportSelector;
let btnExportSelector;
let btnResetSelector;
let btnEraseSelector;
let fileImportSelector;
let usernameSelector;
let loggedOutSelector;
let actionSelector;
let loadingAccountSelector;
let loadingTitleSelector;
let fileInfoSelector;
let uploadSelector;
let fileNameSelector;

let playlistQueue = [];
let savedQueue = [];
let artistQueue = [];
let playlistQueueSize = 0;
let savedQueueSize = 0;
let artistQueueSize = 0;

function init() {
    // Initializing global selector variables
    initializeSelectorVariables();
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
    loginSelector.prop('disabled', function (i, v) {
        return !v;
    });
}

function toggleExportButton() {
    btnExportSelector.prop('disabled', function (i, v) {
        return !v;
    });
}

function loadFile() {
    fileImportSelector.trigger('click');
}

function loadConfig(callback) {
    XHR('config.json', function (response) {
        spotifyConfig = JSON.parse(response).spotifyConfig;
        callback();
    });
}

function initializeSelectorVariables() {
    loginSelector = $('#login');
    btnImportSelector = $('#btnImport');
    btnExportSelector = $('#btnExport');
    btnResetSelector = $('#btnReset');
    btnEraseSelector = $('#btnErase');
    fileImportSelector = $('#fileImport');
    usernameSelector = $('#userName');
    loggedOutSelector = $('#pnlLoggedOut');
    actionSelector = $('#pnlAction');
    loadingAccountSelector = $('#pnlLoadingAccount');
    loadingTitleSelector = $('#loadingTitle');
    fileInfoSelector = $('#pnlFileInfo');
    uploadSelector = $('#pnlUpload');
    fileNameSelector = $('#fileName');
}

function bindControls() {
    loginSelector.click(login);
    btnImportSelector.click(loadFile);
    btnExportSelector.click(download);
    btnResetSelector.click(resetApp);
    btnEraseSelector.click(wipeAccount);
    fileImportSelector.change(readFile);
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

            usernameSelector.html(email);
            loggedOutSelector.hide();

            refreshTrackData(function () {
                // Check for all the data read
                // If user has no music/artists in account disable export button
                if (isEmpty(collections.playlists) &&
                    isEmpty(collections.saved) &&
                    isEmpty(collections.artists)) {
                    toggleExportButton();
                }
                actionSelector.show();
            });
        }
    });
}

function refreshTrackData(callback) {
    if (!isExporting && !isImporting) {
        isExporting = true;
        resetCounter();
        loadingAccountSelector.show();
        loadingTitleSelector.html('Please wait. Loading your followed artists ...');
        refreshFollowedArtists(function () {
            loadingTitleSelector.html('Please wait. Loading your playlists ...');
            refreshPlaylist(function () {
                loadingTitleSelector.html('Please wait. Loading your tracks ...');
                refreshMyMusicTracks(function () {
                    loadingTitleSelector.html('Finished loading, you now might want to export or import.');
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

    fileImportSelector.replaceWith(fileImportSelector.clone());
    fileImportSelector.change(readFile);
}

function resetCounter() {
    globalStep = '';
    playlistStep = 0;
    playlistTotal = 0;
    trackStep = 0;
    trackTotal = 0;
    artistStep = 0;
    artistTotal = 0;
    tries = 0;
    playlistQueueSize = 0;
    savedQueueSize = 0;
    artistQueueSize = 0;
}

function resetVariables() {
    isImporting = false;
    isExporting = false;
    makingChanges = false;
    playlistQueue = [];
    savedQueue = [];
    artistQueue = [];
    collections = {};
    importColl = {};
    authWindow = null;
    token = null;
    userId = null;
    email = null;
}

function resetUI() {
    loadingAccountSelector.hide();
    actionSelector.hide();
    fileInfoSelector.hide();
    uploadSelector.hide();
    loggedOutSelector.show();
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

    if (artistTotal > 0 || trackTotal > 0) {
        if (artistTotal > 0) {
            progress = Math.floor(((artistStep / artistTotal) * 100));
        }
        if (trackTotal > 0) {
            progress = progress > 0 ?
                Math.floor((progress * Math.floor(((trackStep / trackTotal) * 100))) / 100) :
                Math.floor(((trackStep / trackTotal) * 100));
        }
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

            fileNameSelector.html(f.name);
            actionSelector.hide();
            fileInfoSelector.show();
            uploadSelector.show();

            compareEverything();
        };
        r.readAsText(f);
    } else {
        alert("Failed to load file");
    }
}

function wipeAccount() {
    // let response = confirm("This will remove ALL artists/songs/playlists from your account. ARE YOU ABSOLUTELY SURE. THIS CANNOT BE UNDONE!");
    console.log("This is not yet implemented!");
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
    trackDiff = savedQueueSize + playlistQueueSize;
    trackTotal = Math.max(collTrackCount(importColl), trackDiff);
    trackStep = trackTotal - trackDiff;
    // calculate artist differences
    artistTotal = Math.max(collArtistCount(importColl), artistQueueSize);
    artistStep = artistTotal - artistQueueSize;

    if (artistTotal === 0 && trackTotal === 0) {
        globalStep = "No new tracks or artists found in import";
    } else {
        if (artistTotal > 0) {
            $('#progressBar').show();
            globalStep = "Following artists";
            handleArtistRequests(artistQueue, function () {
                globalStep = "Finished following artists";
                artistTotal = artistStep;
            })
        }

        if (trackTotal > 0) {
            $('#progressBar').show();
            globalStep = "Uploading tracks";
            handleSavedRequests(savedQueue, function () {
                handlePlaylistRequests(playlistQueue, function () {
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
            compareUriTracks(importColl.playlists[name].tracks, collections.playlists[name].tracks, function (trackUris) {
                addToPlaylist(playlistId, trackUris);
            });
        }
        handlePlaylistCompare(names, callback);
    });
}

function addToPlaylist(playlistId, trackUris) {
    // We group track URIs in chunks of 50 as it's the limit per request
    let groupedArray = createGroupedArray(trackUris, 50);
    $.each(groupedArray, function (index, value) {
        playlistQueue.push('https://api.spotify.com/v1/users/' + userId + '/playlists/' + playlistId + '/tracks?uris=' + encodeURIComponent(value.toString()));
        playlistQueueSize += value.length;
    });
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
        error: function (xhr) {
            let response = xhr.responseJSON;
            console.log('Error status [%s] with message [%s] inside makeSurePlaylistExists', response.error.status, response.error.message);
            callback(false);
        }
    });
}

function handleArtistRequests(arr, callback) {
    let url = arr.pop();
    if (url) {
        // Adds to step the total of ids sent in request as parameters
        artistStep += new URL(url).searchParams.get("ids").split(",").length;
        $.ajax({
            method: "PUT",
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function () {
            },
            error: function (xhr) {
                let response = xhr.responseJSON;
                console.log('Error status [%s] with message [%s] inside handleArtistRequests', response.error.status, response.error.message);
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
        // Adds to step the total of ids sent in request as parameters
        trackStep += new URL(url).searchParams.get("ids").split(",").length;
        $.ajax({
            method: "PUT",
            url: url,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function () {
            },
            error: function (xhr) {
                let response = xhr.responseJSON;
                console.log('Error status [%s] with message [%s] inside handleSavedRequests', response.error.status, response.error.message);
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
    let urlString = arr.pop();
    if (urlString) {
        let url = new URL(urlString);
        // If for some reason the import file has local files, it will skip them here
        let uriArray = url.searchParams.get("uris").split(",");
        let iterator = uriArray.length;
        while (iterator--) {
            if (uriArray[iterator].startsWith("spotify:local")) {
                // console.log('Found a local file inside import file [%s]. Skipping this one...', uriArray[iterator]);
                uriArray.splice(iterator, 1);
            }
        }

        if (!isEmpty(uriArray)) {
            // Adds to step the total of ids sent in request as parameters
            trackStep += uriArray.length;
            // Setting the curated uris to the URL
            url.searchParams.set("uris", uriArray.toString());
            $.ajax({
                method: "POST",
                url: url.toString(),
                contentType: 'application/json',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                success: function () {
                },
                error: function (xhr) {
                    let response = xhr.responseJSON;
                    console.log('Error status [%s] with message [%s] inside handlePlaylistRequests', response.error.status, response.error.message);
                }
            })
                .always(function () {
                    handlePlaylistRequestsWithTimeout(arr, callback, spotifyConfig.slowdown_import);
                })
        } else {
            // If the uri array is empty (meaning it was only local files) then skip to next batch
            handlePlaylistRequestsWithTimeout(arr, callback, spotifyConfig.slowdown_import);
        }
    } else {
        callback();
    }
}

function addToSaved(trackIds) {
    // We group track IDs in chunks of 50 as it's the limit per request
    let groupedArray = createGroupedArray(trackIds.reverse(), 50);
    $.each(groupedArray, function (index, value) {
        savedQueue.push('https://api.spotify.com/v1/me/tracks?ids=' + value.toString());
        savedQueueSize += value.length;
    });
}

function addToFollowing(artistIds) {
    // We group artist IDs in chunks of 50 as it's the limit per request
    let groupedArray = createGroupedArray(artistIds.reverse(), 50);
    $.each(groupedArray, function (index, value) {
        artistQueue.push('https://api.spotify.com/v1/me/following?type=artist&ids=' + value.toString());
        artistQueueSize += value.length;
    });
}

function compareUriTracks(imported, stored, callback) {

    let urisToAdd = [];

    $.each(imported, function (index, value) {
        let found = false;
        $.each(stored, function (index2, value2) {
            if (value.uri === value2.uri) {
                found = true;
            }
        });
        if (!found) {
            // addCallback(value.uri);
            urisToAdd.push(value.uri);
        }
    });

    callback(urisToAdd);
}

function compareIdTracks(imported, stored, callback) {

    let tracksToAdd = [];

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
            // addCallback(value.id);
            tracksToAdd.push(value.id);
        }
    });

    callback(tracksToAdd);
}

function compareArtists(imported, stored, callback) {

    let artistToAdd = [];

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
            // addCallback(value.id);
            artistToAdd.push(value.id);
        }
    });

    callback(artistToAdd);
}

function refreshMyMusicTracks(callback) {
    collections.saved = [];
    playlistStep += 1;
    loadTrackChunks('https://api.spotify.com/v1/me/tracks?limit=50', collections.saved, callback);
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
                    // Checking if track is not local or null
                    if (!value.is_local && value.track !== null) {
                        arr.push({id: value.track.id, uri: value.track.uri});
                    } else {
                        console.log("Found invalid track. IS LOCAL [%s] IS TRACK NULL [%s]", value.is_local, value.track == null);
                        console.log(value);
                    }
                });
            } else {
                // Checking if track is not local or null
                if (!data.is_local && data.track !== null) {
                    arr.push({id: data.track.id, uri: data.track.uri});
                } else {
                    console.log("Found invalid track. IS LOCAL [%s] IS TRACK NULL [%s]", value.is_local, value.track == null);
                    console.log(value);
                }
            }
            if (data.next) {
                loadTrackChunksWithTimeout(data.next, arr, callback, spotifyConfig.slowdown_export);
            } else {
                callback();
            }
        },
        error: function (xhr) {
            let response = xhr.responseJSON;
            console.log('Error status [%s] with message [%s] inside loadTrackChunks', response.error.status, response.error.message);
            if (tries++ < 3) {
                console.log('Retrying [%s] with [%s] ms delay. Retry %s of 3...', url, spotifyConfig.slowdown_export, tries);
                loadTrackChunksWithTimeout(url, arr, callback, spotifyConfig.slowdown_export);
            } else {
                tries = 0;
                callback();
            }
        }
    });
}

function refreshPlaylist(callback) {
    collections.playlists = {};
    let playlists = [];
    loadPlaylistChunks('https://api.spotify.com/v1/me/playlists?limit=50', playlists, function () {
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
        },
        error: function (xhr) {
            let response = xhr.responseJSON;
            console.log('Error status [%s] with message [%s] inside loadPlaylistChunks', response.error.status, response.error.message);
            if (tries++ < 3) {
                console.log('Retrying [%s]. Retry %s of 3...', url, tries);
                loadPlaylistChunks(url, arr, callback);
            } else {
                tries = 0;
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
        if (isEmpty(arr)) {
            callback();
        } else {
            handlePlaylistTracks(arr, result, callback);
        }
    });
}

function refreshFollowedArtists(callback) {
    collections.artists = [];
    loadArtistChunks('https://api.spotify.com/v1/me/following?type=artist&limit=50', collections.artists, callback);
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

            if (data.artists.next) {
                loadArtistChunks(data.artists.next, arr, callback);
            } else {
                callback();
            }
        },
        error: function (xhr) {
            let response = xhr.responseJSON;
            console.log('Error status [%s] with message [%s] inside loadArtistChunks', response.error.status, response.error.message);
            if (tries++ < 3) {
                console.log('Retrying [%s]. Retry %s of 3...', url, tries);
                loadArtistChunks(url, arr, callback);
            } else {
                tries = 0;
                callback();
            }
        }
    });
}

window.onload = function () {
    if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
        // MSIE
        loggedOutSelector.html('Please use Firefox or Chrome, due to a bug in Internet Explorer');
    } else {
        init();
    }
};