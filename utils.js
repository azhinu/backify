function XHR(file, callback) {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            callback(xhr.responseText);
        }
    };
    xhr.open('GET', file, true);
    xhr.send();
}

function isEmpty(obj) {
    if (Array.isArray(obj)) {
        return obj.length === 0;
    }

    return !obj || Object.keys(obj).length === 0;
}