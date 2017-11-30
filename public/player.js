// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, browser: true, devel: true
'use strict';

class VideoPlayer {

    constructor(options, callback) {

        if (typeof callback !== 'function') {
            this._callback = (err, msg) => {
                if (err) {
                    //throw err; todo
                    console.log(`VideoPlayer Error: ${err} ${this._dataNamespace}`);
                    return;
                }
                console.log(`VideoPlayer Message: ${msg} ${this._dataNamespace}`);
            };
        } else {
            this._callback = callback;
        }

        if (!options.video || !(options.video instanceof HTMLVideoElement)) {
            this._callback('"options.video" is not a video element');
            return;
        }
        this._video = options.video;

        if (!options.namespace) {
            this._callback('missing "options.namespace"');//verify begins with slash and atleast 1 character "/abc" todo
            return;
        }
        this._dataNamespace = options.namespace;//might be room or namespace of socket todo

        if (!options.io || !options.io.hasOwnProperty('Socket')) {
            this._callback('"options.io is not an instance of socket.io');
            return;
        }
        this._socket = options.io(location.origin + this._dataNamespace, {transports: ['websocket'], forceNew: true});//only supporting socket.io at this point todo

        //have to set socket error handler todo

        //maybe this is ok, not sure about binding to keep scope to "this" but works ok todo
        //this._onMime = this._onMime.bind(this);
        this.onMime = this._onMime.bind(this);

        //listen for mime type response from server
        this._socket.on('mime', this.onMime);

        //send request for mime type to server
        this._socket.emit('message', 'mime');

        //return this; for chaining calls, what calls??? todo
        return this;
    }

    _onMime(data) {
        this._mime = data;
        this._socket.removeListener('mime', this.onMime);
        this.onInit = this._onInit.bind(this);
        this._socket.on('init', this.onInit);
        this._socket.emit('message', 'init');
    }

    _onInit(data) {
        this._init = data;
        this._socket.removeListener('mime', this.onInit);
        this._mediaSource = new window.MediaSource();
        this.mediaSourceError = this._mediaSourceError.bind(this);
        this.mediaSourceOpen = this._mediaSourceOpen.bind(this);
        this.mediaSourceClose = this._mediaSourceClose.bind(this);
        this.mediaSourceEnded = this._mediaSourceEnded.bind(this);
        this._mediaSource.addEventListener('error', this.mediaSourceError);
        this._mediaSource.addEventListener('sourceopen', this.mediaSourceOpen);
        this._mediaSource.addEventListener('sourceclose', this.mediaSourceClose);
        this._mediaSource.addEventListener('sourcended', this.mediaSourceEnded);
        this._video.src = window.URL.createObjectURL(this._mediaSource);
    }

    _onSegment(data) {
        //const segment = data;//new Uint8Array(data);
        //console.log('segment length ' + segment.length);
        //check if sourceBuffer is busy, then add to buffer queue todo
        if (this._sourceBuffer.updating) {
            this._callback(null, 'source buffer updating');
            //never store more than the most recent segment received because we are trying to stay as close to realtime as possible
            this._lastSegment = data;
        } else {
            //this._lastSegment = undefined;
            delete this._lastSegment;
            this._sourceBuffer.appendBuffer(data);

        }
        //else, let the data drop
    }

    _mediaSourceError(error) {
        alert('error ' + error);
        alert(this instanceof VideoPlayer);
    }

    _mediaSourceOpen(event) {
        //alert('sourceopen ' + event);
        //alert(this instanceof VideoPlayer);
        this._sourceBuffer = this._mediaSource.addSourceBuffer(this._mime);
        this._sourceBuffer.mode = 'sequence';
        this.sourceBufferUpdate = this._sourceBufferUpdate.bind(this);
        this._sourceBuffer.addEventListener('update', this.sourceBufferUpdate);
        this.sourceBufferUpdateEnd = this._sourceBufferUpdateEnd.bind(this);
        this._sourceBuffer.addEventListener('updateend', this.sourceBufferUpdateEnd);
        this._sourceBuffer.appendBuffer(this._init);
        this.onSegment = this._onSegment.bind(this);
        this._socket.on('segment', this.onSegment);
        this._socket.emit('message', 'segment');
        this._video.play();
        //todo will add custom controls
        //this._video.addEventListener('pause', (event) => {
        //event.preventDefault();
        //alert(event);
        //this._video.play();
        //});
    }

    _mediaSourceClose(event) {
        alert('sourceclose ' + event);
        alert(this instanceof VideoPlayer);
    }

    _mediaSourceEnded(event) {
        alert('sourceended ' + event);
        alert(this instanceof VideoPlayer);
    }

    _sourceBufferUpdate(event) {
        //alert('update ' + event);
        //alert(this instanceof VideoPlayer);
    }

    _sourceBufferUpdateEnd(event) {

        //fix for safari to get video playing
        if (this._mediaSource.duration !== Number.POSITIVE_INFINITY && this._video.currentTime === 0 && this._mediaSource.duration > 0) {
            this._video.currentTime = this._mediaSource.duration - 1;
            this._mediaSource.duration = Number.POSITIVE_INFINITY;
        }

        //we have a pending segment that arrived while this._sourceBuffer.updating === true
        if (this._lastSegment) {
            this._callback(null, 'using this._lastSegment');
            this._sourceBuffer.appendBuffer(this._lastSegment);
            delete this._lastSegment;
        }

        //todo add buffer queue here if new segment arrived before old segment added to buffer triggering update end
    }

}

(function () {
    
    if (!('io' in window)) {
        alert('socket.io was not found');
        return;
    }
    
    //get all video elements on page
    const videos = document.getElementsByTagName('video');

    //array to keep reference to newly created VideoPlayers
    const videoPlayers = [];

    for (let i = 0; i < videos.length; i++) {
        if (videos[i].hasAttribute('data-namespace')) {//only grab video elements that deliberately have data-namespace attribute
            videoPlayers.push(new VideoPlayer({
                video: videos[i],
                io: window.io,
                namespace: videos[i].getAttribute('data-namespace')
            }));
        }
    }

    //add some listeners to video element to pass commands into mse

})();


//todo steps for creation of video player
//script is loaded at footer so that it can run after html is ready on page
//verify that socket.io is defined in window
//iterate each video element that has custom data-namespace attributes that we need
//initiate socket to get information from server
//first request codec string to test against browser and then feed first into source
//then request init-segment to feed
//then request segments until we run into pause, stop, close, error, buffer not ready, etc
//change poster on video element based on current status, error, not ready, etc