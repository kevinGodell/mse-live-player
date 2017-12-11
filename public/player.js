// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, browser: true, devel: true
/*global MediaSource*/
/*global URL*/
/*global io*/
'use strict';

class VideoPlayer {
    constructor(options, callback) {
        if (typeof callback === 'function') {
            this._callback = callback;
        } else {
            this._callback = (err, msg) => {
                if (err) {
                    console.error(`VideoPlayer Error: ${err} ${this._namespace}`);
                    return;
                }
                console.log(`VideoPlayer Message: ${msg} ${this._namespace}`);
            };
        }
        if (!options.video || !(options.video instanceof HTMLVideoElement)) {
            this._callback('"options.video" is not a video element');
            return;
        }
        if (!options.namespace) {
            this._callback('missing "options.namespace"');
            return;
        }
        if (!options.io || !options.io.hasOwnProperty('Socket')) {
            this._callback('"options.io is not an instance of socket.io');
            return;
        }

        this._video = options.video;

        if (options.controls) {
            const ssb = options.controls.indexOf('startstop') !== -1;
            const fsb = options.controls.indexOf('fullscreen') !== -1;
            if (ssb || fsb) {

                this._container = document.createElement('div');
                this._container.className = 'video';
                this._video.parentNode.replaceChild(this._container, this._video);
                this._video.className = 'mse';
                this._video.controls = false;
                this._video.removeAttribute('controls');
                this._container.appendChild(this._video);

                if (ssb) {
                    this._startstop = document.createElement('button');
                    this._start = document.createElement('i');
                    this._start.className = 'fa fa-play fa-2x';
                    this._start.style.color = 'white';
                    this._start.setAttribute('aria-hidden', 'true');
                    this._startstop.appendChild(this._start);

                    this._stop = document.createElement('i');
                    this._stop.className = 'fa fa-stop fa-2x';
                    this._stop.style.color = 'white';
                    this._stop.setAttribute('aria-hidden', 'true');
                    //this._startstop.appendChild(this._stop);
                    //this._stop.style.display = 'none';

                    //this._startstop.innerHTML = '<i class="fa fa-play fa-2x" style="color:white" aria-hidden="true"></i>';

                    this._running = false;

                    this._startstop.className = 'startstop';
                    this._startstop.addEventListener('click', (event) => {
                        //alert('start/stop button not implemented yet');
                        //return;
                        if (this._running) {
                            this.stop();
                        } else {
                            this.start();
                        }
                    });
                    this._container.appendChild(this._startstop);
                }

                if (fsb) {
                    const fullscreenButton = document.createElement('button');
                    fullscreenButton.innerHTML = '<i class="fa fa-arrows-alt fa-2x" style="color:white" aria-hidden="true"></i>';
                    fullscreenButton.className = 'fullscreen';
                    fullscreenButton.addEventListener('click', (event) => {
                        if (this._container.requestFullscreen) {
                            this._container.requestFullscreen();
                        } else if (this._container.mozRequestFullScreen) {
                            this._container.mozRequestFullScreen();
                        } else if (this._container.webkitRequestFullScreen) {
                            this._container.webkitRequestFullScreen();
                        } else if (this._container.msRequestFullscreen) {
                            this._container.msRequestFullscreen();
                        }
                    });
                    this._container.appendChild(fullscreenButton);
                }
            }
            
            
        }

        this._addVideoEvents();
        //todo check namespace first, then check socket.io as user has intention to use socket.io
        this._namespace = options.namespace;//might be room or namespace of socket todo
        this._io = options.io;
        //only supporting socket.io at this point todo add support for ws
        return this;
    }
    
    _createControls(value) {
        
    }

    start() {
        if (this._startstop) {
            this._startstop.replaceChild(this._stop, this._start);
        }
        this._running = true;
        this._socket = this._io(`${location.origin}/${this._namespace}`, {transports: ['websocket'], forceNew: false});
        this._addSocketEvents();
        return this;
    }

    stop() {
        //todo
        this._running = false;
        if (this._startstop) {
            this._startstop.replaceChild(this._start, this._stop);
        }
        this._cleanUp();
    }

    destroy() {
        //todo
    }
    
    mediaInfo() {
        let str = `******************\n`;
        str += `namespace : ${this._namespace}\n`;
        if (this._video) {
            str += `video.paused : ${this._video.paused}\nvideo.currentTime : ${this._video.currentTime}\nvideo.src : ${this._video.src}\n`;
            if (this._sourceBuffer.buffered.length) {
                str += `buffered.length : ${this._sourceBuffer.buffered.length}\nbuffered.end(0) : ${this._sourceBuffer.buffered.end(0)}\nbuffered.start(0) : ${this._sourceBuffer.buffered.start(0)}\nbuffered size : ${this._sourceBuffer.buffered.end(0) - this._sourceBuffer.buffered.start(0)}\nlag : ${this._sourceBuffer.buffered.end(0) - this._video.currentTime}\n`;
            }
        }
        str += `******************\n`;
        console.info(str);
    }

    _cleanUp() {//todo will change to stop, need to add public destroy() that will call stop() and cleanup
        this._callback(null, 'CLEAN UP');
        if (this._video) {
            this._removeVideoEvents();
            this._video.pause();
            this._video.src = '';
            this._video.load();
        }
        if (this._socket) {
            alert(this._socket.connected);
            this._removeSocketEvents();
            if (this._socket.connected) {
                this._socket.disconnect();
            }
            delete this._socket;
        }
        if (this._mediaSource) {
            this._removeMediaSourceEvents();
            if (this._mediaSource.sourceBuffers && this._mediaSource.sourceBuffers.length) {
                this._mediaSource.removeSourceBuffer(this._sourceBuffer);
            }
            delete this._mediaSource;
        }
        if (this._sourceBuffer) {
            this._removeSourceBufferEvents();
            if (this._sourceBuffer.updating) {
                this._sourceBuffer.abort();
            }
            delete this._sourceBuffer;
        }
    }

    ///////////////////// video element events /////////////////////////

    _onVideoError(event) {
        this._callback(`video ${event.type}`);
    }

    _addVideoEvents() {
        if (!this._video) {
            return;
        }
        this.onVideoError = this._onVideoError.bind(this);
        this._video.addEventListener('error', this.onVideoError, {capture: true, passive: true, once: true});
    }

    _removeVideoEvents() {
        if (!this._video) {
            return;
        }
        this._video.removeEventListener('error', this.onVideoError, {capture: true, passive: true, once: true});
        delete this.onVideoError;
    }

    ///////////////////// media source events ///////////////////////////

    _onMediaSourceClose(event) {
        this._callback(null, `media source close ${event.type}`);
    }

    _onMediaSourceOpen(event) {
        //this._callback(null, `media source open ${event.type}`);
        URL.revokeObjectURL(this._video.src);
        this._mediaSource.duration = Number.POSITIVE_INFINITY;
        this._sourceBuffer = this._mediaSource.addSourceBuffer(this._mime);
        this._sourceBuffer.mode = 'sequence';
        this._addSourceBufferEvents();
        this._sourceBuffer.appendBuffer(this._init);
        //this._video.setAttribute('poster', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnPjxyZWN0IHg9Ii0xIiB5PSItMSIgd2lkdGg9IjY0MiIgaGVpZ2h0PSIzNiIgZmlsbD0ibm9uZSIvPjwvZz48Zz48dGV4dCBmaWxsPSIjMDAwIiBzdHJva2Utd2lkdGg9IjAiIHg9IjE2MCIgeT0iMjYiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmIiB0ZXh0LWFuY2hvcj0ic3RhcnQiIHhtbDpzcGFjZT0icHJlc2VydmUiIHN0cm9rZT0iIzAwMCI+cmVxdWVzdGluZyBtZWRpYSBzZWdtZW50czwvdGV4dD48L2c+PC9zdmc+');
        this.onSegment = this._onSegment.bind(this);
        this._socket.addEventListener('segment', this.onSegment, {capture: true, passive: true, once: false});
        this._socket.send('segments');
        //this._video.muted = true;
        if ('Promise' in window) {
            this._video.play()
                .then(() => {
                    //this._callback(null, 'play promise fulfilled');
                    //todo remove "click to play" poster
                })
                .catch((error) => {
                    this._callback(error);
                    //todo add "click to play" poster
                });
        } else {
            this._video.play();
        }
    }

    _addMediaSourceEvents() {
        if (!this._mediaSource) {
            return;
        }
        this.onMediaSourceClose = this._onMediaSourceClose.bind(this);
        this._mediaSource.addEventListener('sourceclose', this.onMediaSourceClose, {capture: true, passive: true, once: true});
        this.onMediaSourceOpen = this._onMediaSourceOpen.bind(this);
        this._mediaSource.addEventListener('sourceopen', this.onMediaSourceOpen, {capture: true, passive: true, once: true});
    }

    _removeMediaSourceEvents() {
        if (!this._mediaSource) {
            return;
        }
        this._mediaSource.removeEventListener('sourceclose', this.onMediaSourceClose, {capture: true, passive: true, once: true});
        delete this.onMediaSourceClose;
        this._mediaSource.removeEventListener('sourceopen', this.onMediaSourceOpen, {capture: true, passive: true, once: true});
        delete this.onMediaSourceOpen;
    }

    ///////////////////// source buffer events /////////////////////////
    
    _onSourceBufferError(event) {
        this._callback(`sourceBufferError ${event.type}`);
    }

    _onSourceBufferUpdateEnd(event) {
        //cant do anything to sourceBuffer if it is updating
        if (this._sourceBuffer.updating) {
            return;
        }
        //if has last segment pending, append it
        if (this._lastSegment) {
            //this._callback(null, 'using this._lastSegment');
            this._sourceBuffer.appendBuffer(this._lastSegment);
            delete this._lastSegment;
            return;
        }
        //check if buffered media exists
        if (!this._sourceBuffer.buffered.length) {
            return;
        }
        const currentTime = this._video.currentTime;
        const start = this._sourceBuffer.buffered.start(0);
        const end = this._sourceBuffer.buffered.end(0);
        const past = currentTime - start;
        //todo play with numbers and make dynamic or user configurable
        if (past > 20 && currentTime < end) {
            this._sourceBuffer.remove(start, currentTime - 4);
        }
    }

    _addSourceBufferEvents() {
        if(!this._sourceBuffer) {
            return;
        }
        this.onSourceBufferError = this._onSourceBufferError.bind(this);
        this._sourceBuffer.addEventListener('error', this.onSourceBufferError, {capture: true, passive: true, once: true});
        this.onSourceBufferUpdateEnd = this._onSourceBufferUpdateEnd.bind(this);
        this._sourceBuffer.addEventListener('updateend', this.onSourceBufferUpdateEnd, {capture: true, passive: true, once: false});
    }

    _removeSourceBufferEvents() {
        if(!this._sourceBuffer) {
            return;
        }
        this._sourceBuffer.removeEventListener('error', this.onSourceBufferError, {capture: true, passive: true, once: true});
        delete this.onSourceBufferError;
        this._sourceBuffer.removeEventListener('updateend', this.onSourceBufferUpdateEnd, {capture: true, passive: true, once: false});
        delete this.onSourceBufferUpdateEnd;
    }

    ///////////////////// socket.io events //////////////////////////////
    
    _onSocketConnect(event) {
        //this._callback(null, 'socket connect');
        //this._video.setAttribute('poster', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnPjxyZWN0IHg9Ii0xIiB5PSItMSIgd2lkdGg9IjY0MiIgaGVpZ2h0PSIzNiIgZmlsbD0ibm9uZSIvPjwvZz48Zz48dGV4dCBmaWxsPSIjMDAwIiBzdHJva2Utd2lkdGg9IjAiIHg9IjE5NiIgeT0iMjYiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmIiB0ZXh0LWFuY2hvcj0ic3RhcnQiIHhtbDpzcGFjZT0icHJlc2VydmUiIHN0cm9rZT0iIzAwMCI+cmVxdWVzdGluZyBtaW1lIHR5cGU8L3RleHQ+PC9nPjwvc3ZnPg==');
        this.onMime = this._onMime.bind(this);
        this._socket.addEventListener('mime', this.onMime, {capture: true, passive: true, once: true});
        this._socket.send('mime');
    }
    
    _onSocketDisconnect(event) {
        this._callback(`socket disconnect "${event}"`);
        this._cleanUp();
    }
    
    _onSocketError(event) {
        this._callback(`socket error "${event}"`);
        this._cleanUp();
    }

    _onMime(data) {
        this._mime = data;
        if (!MediaSource.isTypeSupported(this._mime)) {
            this._video.setAttribute('poster', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnPjxyZWN0IHg9Ii0xIiB5PSItMSIgd2lkdGg9IjY0MiIgaGVpZ2h0PSIzNiIgZmlsbD0ibm9uZSIvPjwvZz48Zz48dGV4dCBmaWxsPSIjMDAwIiBzdHJva2Utd2lkdGg9IjAiIHg9IjE3NyIgeT0iMjYiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmIiB0ZXh0LWFuY2hvcj0ic3RhcnQiIHhtbDpzcGFjZT0icHJlc2VydmUiIHN0cm9rZT0iIzAwMCI+bWltZSB0eXBlIG5vdCBzdXBwb3J0ZWQ8L3RleHQ+PC9nPjwvc3ZnPg==');
            this._callback(`unsupported mime "${this._mime}"`);
            return;
        }
        //this._video.setAttribute('poster', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnPjxyZWN0IHg9Ii0xIiB5PSItMSIgd2lkdGg9IjY0MiIgaGVpZ2h0PSIzNiIgZmlsbD0ibm9uZSIvPjwvZz48Zz48dGV4dCBmaWxsPSIjMDAwIiBzdHJva2Utd2lkdGg9IjAiIHg9IjE4NiIgeT0iMjYiIGZvbnQtc2l6ZT0iMjYiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmIiB0ZXh0LWFuY2hvcj0ic3RhcnQiIHhtbDpzcGFjZT0icHJlc2VydmUiIHN0cm9rZT0iIzAwMCI+cmVxdWVzdGluZyBpbml0IHNlZ21lbnQ8L3RleHQ+PC9nPjwvc3ZnPg==');
        this.onInit = this._onInit.bind(this);
        this._socket.addEventListener('initialization', this.onInit, {capture: true, passive: true, once: true});
        this._socket.send('initialization');
    }

    _onInit(data) {
        this._init = data;
        this._mediaSource = new MediaSource();
        this._addMediaSourceEvents();
        this._video.src = URL.createObjectURL(this._mediaSource);
    }

    _onSegment(data) {
        if (this._sourceBuffer.buffered.length) {
            const lag = this._sourceBuffer.buffered.end(0) - this._video.currentTime;
            if (lag > 0.5) {
                this._video.currentTime = this._sourceBuffer.buffered.end(0) - 0.5;
            }
        }
        if (this._sourceBuffer.updating) {
            this._lastSegment = data;
        } else {
            delete this._lastSegment;
            this._sourceBuffer.appendBuffer(data);
        }
    }

    _addSocketEvents() {
        if (!this._socket) {
            return;
        }
        this.onSocketConnect = this._onSocketConnect.bind(this);
        this._socket.addEventListener('connect', this.onSocketConnect, {capture: true, passive: true, once: true});
        this.onSocketDisconnect = this._onSocketDisconnect.bind(this);
        this._socket.addEventListener('disconnect', this.onSocketDisconnect, {capture: true, passive: true, once: true});
        this.onSocketError = this._onSocketError.bind(this);
        this._socket.addEventListener('error', this.onSocketError, {capture: true, passive: true, once: true});
    }

    _removeSocketEvents() {
        if (!this._socket) {
            return;
        }
        this._socket.removeEventListener('connect', this.onSocketConnect, {capture: true, passive: true, once: true});
        delete this.onSocketConnect;
        this._socket.removeEventListener('disconnect', this.onSocketDisconnect, {capture: true, passive: true, once: true});
        delete this.onSocketDisconnect;
        this._socket.removeEventListener('error', this.onSocketError, {capture: true, passive: true, once: true});
        delete this.onSocketError;
        this._socket.removeEventListener('mime', this.onMime, {capture: true, passive: true, once: true});
        delete this.onMime;
        this._socket.removeEventListener('initialization', this.onInit, {capture: true, passive: true, once: true});
        delete this.onInit;
        this._socket.removeEventListener('segment', this.onSegment, {capture: true, passive: true, once: false});
        delete this.onSegment;
    }

}

(function () {

    if (!('io' in window)) {
        throw new Error('socket.io was not found');
        //return;
    }

    //get all video elements on page
    const videos = document.getElementsByTagName('video');

    //array to keep reference to newly created VideoPlayers, maybe could be a keyed object
    const videoPlayers = [];

    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        //only grab video elements that deliberately have data-namespace attribute
        if (video.dataset.namespace) {
            videoPlayers.push(new VideoPlayer({video: video, io: io, namespace: video.dataset.namespace, controls: video.dataset.controls}).start());
        }
    }

})();


//todo steps for creation of video player
//script is loaded at footer so that it can run after html is ready on page
//verify that socket.io is defined in window
//iterate each video element that has custom data-namespace attributes that we need
//initiate socket to get information from server
//first request codec string to test against browser and then feed first into source
//then request init-segment to feed
//then request media segments until we run into pause, stop, close, error, buffer not ready, etc
//change poster on video element based on current status, error, not ready, etc