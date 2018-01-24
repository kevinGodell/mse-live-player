'use strict';

const { spawn } = require('child_process');
const { Writable } = require('stream');
const { EventEmitter } = require('events');

class FfmpegRespawn extends EventEmitter {
    /**
     *
     * @param options
     * @param options.params
     * @param options.pipes
     * @param options.path
     * @param options.exitCallback
     * @param options.stallKillDelay
     * @param options.exitSpawnDelay
     * @returns {FfmpegRespawn}
     */
    constructor(options) {
        super(options);

        if (!options) {
            throw new Error('Must pass a configuration object');
        }

        //set defaults that will be passed to spawned ffmpeg, will update when looping through params
        this._stdio = ['ignore', 'ignore', 'ignore', 'pipe'];

        if (!options.params || !Array.isArray(options.params) || options.params.length < 3) {
            throw new Error('Params error: must be an array with a minimum of 3 items.');
        }

        //set params property
        this._params = options.params;

        //loop through params and configure pipes
        for (let i = 0; i < this._params.length; i++) {
            if (this._params[i] === '-i' && (this._params[i + 1] === 'pipe:0' || this._params[i + 1] === '-' || this._params[i + 1] === 'pipe:')) {
                throw new Error('Params error: stdin/stdio[0]/pipe:0 not supported yet.');
            } else if (this._params[i] === 'pipe:1' || ((this._params[i] === 'pipe:' || this._params[i] === '-') && this._params[i - 1] !== '-i')) {
                this._stdio[1] = 'pipe';
            } else if (this._params[i] === '-loglevel' && this._params[i + 1] !== 'quiet' && this._params[i + 1] !== '-8') {
                this._stdio[2] = 'inherit';
            } else if (this._params[i] === 'pipe:2') {
                throw new Error('Params error: "pipe:2" is reserved for logging to console.');
            } else if (this._params[i] === 'pipe:3') {
                throw new Error('Params error: "pipe:3" is reserved for progress monitoring.');
            } else {
                const results = /pipe:(\d+)/.exec(this._params[i]);
                if (results && results.index === 0) {
                    this._stdio[results[1]] = 'pipe';
                }
            }
        }

        //test if any pipes were skipped based on params
        for (let i = 0; i < this._stdio.length; i++) {
            if (this._stdio[i] === undefined) {
                throw new Error(`Params error: "pipe:${i}" was skipped.`);
            }
        }

        //add the progress pipe to front of params array
        this._params.unshift(...['-progress', 'pipe:3']);

        //will be used to keep track of pipes passed to spawned process
        this._pipes = [];

        //create writable pipe used for reading progress data
        const onProgress = this._onProgress.bind(this);
        const progressPipe = new Writable({
            write(chunk, encoding, callback) {
                const array = chunk.toString().split('\n').slice(0, -1);
                const object = {};
                for (let i = 0; i < array.length; i++) {
                    const tempArr = array[i].split('=');
                    object[tempArr[0]] = tempArr[1].trimLeft();
                }
                onProgress(object);
                callback();
            }
        });

        //add the progress pipe to our pipes array
        this._pipes.push({stdioIndex: 3, destination: progressPipe});

        //check pipes to see if necessary pipe:i's have been passed in params
        if (options.pipes && Array.isArray(options.pipes) && options.pipes.length) {
            for (let i = 0; i < options.pipes.length; i++) {
                const pipe = options.pipes[i];
                const stdioIndex = pipe.stdioIndex;
                const destination = pipe.destination;
                //check that it is writable, will include duplex and transform since they are inherited from writable
                if(!(destination instanceof Writable)) {
                    throw new Error(`Destination: "${destination}" must be a stream instance of Writable, Duplex, or Transform.`);
                }
                if (stdioIndex === 0) {
                    throw new Error('Pipes error: stdin/stdio[0]/pipe:0 not supported yet');
                }
                if (stdioIndex === 2 || stdioIndex === 3) {
                    throw new Error(`Pipes error: "pipe:${stdioIndex}" is reserved. Use pipe:1,pipe:4, or higher`);
                }
                if (this._stdio[stdioIndex] === 'pipe') {
                    this._pipes.push(pipe);
                } else {
                    throw new Error(`Params/Pipes mismatch: pipe:${stdioIndex} not found in params.`);
                }
            }
        }

        //optional, path to ffmpeg
        if (options.path) {
            this._path = options.path;
        } else {
            this._path = 'ffmpeg';
        }

        //optional, function to be called when internal ffmpeg process exits
        if (options.exitCallback && typeof options.exitCallback === 'function') {
            this._exitCallback = options.exitCallback;
        }

        //configure time that passes without progress to trigger ffmpeg to be killed
        const stallKillDelay = parseInt(options.stallKillDelay);
        if (isNaN(stallKillDelay) || stallKillDelay < 10) {
            this._stallKillDelay = 10000;
        } else if (stallKillDelay > 60) {
            this._stallKillDelay = 60000;
        } else {
            this._stallKillDelay = stallKillDelay * 1000;
        }

        //configure time to wait before re spawning ffmpeg after exit
        const exitSpawnDelay = parseInt(options.exitSpawnDelay);
        if (isNaN(exitSpawnDelay) || exitSpawnDelay < 2) {
            this._exitSpawnDelay = 2000;
        } else if (exitSpawnDelay > 60) {
            this._exitSpawnDelay = 60000;
        } else {
            this._exitSpawnDelay = exitSpawnDelay * 1000;
        }

        //todo move loglevel to options
        //if (options.loglevel) {
            //console.log(options.loglevel);
        //}
        return this;// not needed
        //todo check stdin for readable stream
    }

    /**
     *
     * @readonly
     * @returns {string | null}
     */
    get params() {
        return this._params.join(' ') || null;
    }

    /**
     *
     * @readonly
     * @returns {boolean}
     */
    get running() {
        return this._running || false;
    }

    /**
     *
     * @returns {FfmpegRespawn}
     */
    start() {
        if (this._running !== true) {
            this._running = true;
            this._spawn();
        }
        return this;
    }

    /**
     *
     * @returns {FfmpegRespawn}
     */
    stop() {
        if (this._running === true) {
            this._running = false;
            this._stopStallTimer();
            this._stopSpawnTimer();
            this._kill();
        }
        return this;
    }

    /**
     *
     * @private
     */
    _spawn() {
        this._ffmpeg = spawn(this._path, this._params, {stdio: this._stdio});
        this._ffmpeg.once('error', (error)=> {
            //this.kill();
            throw error;
        });
        this._ffmpeg.once('exit', this._onExit.bind(this));
        for (let i = 0; i < this._pipes.length; i++) {
            this._ffmpeg.stdio[this._pipes[i].stdioIndex].pipe(this._pipes[i].destination, {end: false});
        }
        this._startStallTimer();
    }

    /**
     *
     * @private
     */
    _kill() {
        if (this._ffmpeg) {
            if (this._ffmpeg.kill(0)) {
                for (let i = 0; i < this._pipes.length; i++) {
                    this._ffmpeg.stdio[this._pipes[i].stdioIndex].unpipe(this._pipes[i].destination);
                }
                this._ffmpeg.kill('SIGHUP');//SIGTERM, SIGINT
            }
            delete this._ffmpeg;
        }
    }

    /**
     *
     * @param code
     * @param signal
     * @private
     */
    _onExit(code, signal) {
        this._kill();
        this._stopStallTimer();
        if (this._running === true) {
            this._startSpawnTimer();
        }
        if (this._exitCallback) {
            this._exitCallback();
        } else {
            this.emit('exit', code, signal);
        }
    }

    /**
     *
     * @param object
     * @private
     */
    _onProgress(object) {
        if (object.progress === 'continue') {
            this._startStallTimer();
        } else if (object.progress === 'end') {
            console.log('progress end');
        }
    }

    /**
     *
     * @private
     */
    _onStall() {
        this._stopStallTimer();
        this._kill();
    }

    /**
     *
     * @private
     */
    _startStallTimer() {
        if (this._stallTimer) {
            clearTimeout(this._stallTimer);
        }
        this._stallTimer = setTimeout(this._onStall.bind(this), this._stallKillDelay);
    }

    /**
     *
     * @private
     */
    _stopStallTimer() {
        if (this._stallTimer) {
            clearTimeout(this._stallTimer);
            delete this._stallTimer;
        }
    }

    /**
     *
     * @private
     */
    _onSpawn() {
        this._stopSpawnTimer();
        this._spawn();
    }

    /**
     *
     * @private
     */
    _startSpawnTimer() {
        if (this._spawnTimer) {
            clearTimeout(this._spawnTimer);
        }
        this._spawnTimer = setTimeout(this._onSpawn.bind(this), this._exitSpawnDelay);
    }

    /**
     *
     * @private
     */
    _stopSpawnTimer() {
        if (this._spawnTimer) {
            clearTimeout(this._spawnTimer);
            delete this._spawnTimer;
        }
    }
}

/**
 *
 * @type {FfmpegRespawn}
 */
module.exports = FfmpegRespawn;