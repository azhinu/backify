let spotifyConfig;

window.onload = function () {
    loadConfig(function () {
        let target = window.self === window.top ? window.opener : window.parent;
        let hash = window.location.hash;
        let token;

        if (hash) {
            token = hash.split('&')[0].split('=')[1];
        }

        target.postMessage(token, spotifyConfig.uri);
    });
};

function loadConfig(callback) {
    XHR('config.json', function (response) {
        spotifyConfig = JSON.parse(response).spotifyConfig;
        callback();
    });
}