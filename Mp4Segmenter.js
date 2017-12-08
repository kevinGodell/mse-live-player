// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true
'use strict';

const { Transform } = require('stream');

class Mp4Segmenter extends Transform {
    constructor(options, callback) {
        super(options);
        if (typeof callback === 'function') {
            this._callback = callback;
        }
        this._parseChunk = this._findFtyp;
    }
    
    get mime() {
        return this._mime || null;
    }

    get initialization() {
        return this._initialization || null;
    }
    
    get segment() {
        return this._segment || null;
    }
    
    get segmentTimestamp() {
        return this._segmentTimestamp || null;
    }

    _findFtyp(chunk) {
        const chunkLength = chunk.length;
        if (chunkLength < 8 || chunk[4] !== 0x66 || chunk[5] !== 0x74 || chunk[6] !== 0x79 || chunk[7] !== 0x70) {
            throw new Error('cannot find ftyp');
        }
        this._ftypLength = chunk.readUInt32BE(0, true);
        if (this._ftypLength < chunkLength) {
            this._ftyp = chunk.slice(0, this._ftypLength);
            this._parseChunk = this._findMoov;
            this._parseChunk(chunk.slice(this._ftypLength));
        } else if (this._ftypLength === chunkLength) {
            this._ftyp = chunk;
            this._parseChunk = this._findMoov;
        } else {
            //should not be possible to get here because ftyp is very small
            throw new Error('ftypLength greater than chunkLength');
        }
    }

    _findMoov(chunk) {
        const chunkLength = chunk.length;
        if (chunkLength < 8 || chunk[4] !== 0x6D || chunk[5] !== 0x6F || chunk[6] !== 0x6F || chunk[7] !== 0x76) {
            throw new Error('cannot find moov');
        }
        const moovLength = chunk.readUInt32BE(0, true);
        if (moovLength < chunkLength) {
            this._parseMoov(Buffer.concat([this._ftyp, chunk], (this._ftypLength + moovLength)));
            delete this._ftyp;
            delete this._ftypLength;
            this._parseChunk = this._findMoof;
            this._parseChunk(chunk.slice(moovLength));
        } else if (moovLength === chunkLength) {
            this._parseMoov(Buffer.concat([this._ftyp, chunk], (this._ftypLength + moovLength)));
            delete this._ftyp;
            delete this._ftypLength;
            this._parseChunk = this._findMoof;
        } else {
            //probably should not arrive here here
            //if we do, will have to store chunk until size is big enough to have entire moov piece
            throw new Error('moovLength greater than chunkLength');
        }
    }
    
    _parseMoov(value) {
        this._initialization = value;
        let audioString = '';
        if (this._initialization.indexOf('mp4a') !== -1) {
            audioString = ', mp4a.40.2';
        }
        let index = this._initialization.indexOf('avcC');
        if (index === -1) {
            throw new Error('moov does not contain codec information');
        }
        index += 5;
        this._mime = `video/mp4; codecs="avc1.${this._initialization.slice(index , index + 3).toString('hex').toUpperCase()}${audioString}"`;
        this.emit('initialized');
    }

    _moofHunt(chunk) {
        const index = chunk.indexOf('moof');
        if (index > 3) {
            this._parseChunk = this._findMoof;
            this._parseChunk(chunk.slice(index - 4));
        }
    }
    
    _findMoof(chunk) {
        const chunkLength = chunk.length;
        if (chunkLength < 8 || chunk[4] !== 0x6D || chunk[5] !== 0x6F || chunk[6] !== 0x6F || chunk[7] !== 0x66) {
            //did not previously parse a complete segment
            if (!this._segment) {
                console.log(chunk.slice(0, 20).toString());
                throw new Error('immediately failed to find moof');
            } else {
                //have to do a string search for moof or mdat and start loop again,
                //sometimes ffmpeg gets a blast of data and sends it through corrupt
                this._parseChunk = this._moofHunt;
                this._parseChunk(chunk);
            }
        }
        this._moofLength = chunk.readUInt32BE(0, true);
        if (this._moofLength < chunkLength) {
            this._moof = chunk.slice(0, this._moofLength);
            this._parseChunk = this._findMdat;
            this._parseChunk(chunk.slice(this._moofLength));
        } else if (this._moofLength === chunkLength) {
            this._moof = chunk;
            this._parseChunk = this._findMdat;
        } else {
            //situation has not occurred yet
            throw new Error('mooflength > chunklength');
        }
    }

    _setSegment(chunk) {
        this._segment = chunk;
        this._segmentTimestamp = Date.now();
    }
    
    _findMdat(chunk) {
        if (this._mdatBuffer) {
            this._mdatBuffer.push(chunk);
            this._mdatBufferSize += chunk.length;
            if (this._mdatLength === this._mdatBufferSize) {
                this._setSegment(Buffer.concat([this._moof, ...this._mdatBuffer], (this._moofLength + this._mdatLength)));
                delete this._moof;
                delete this._mdatBuffer;
                delete this._moofLength;
                delete this._mdatLength;
                delete this._mdatBufferSize;
                if (this._readableState.pipesCount > 0) {
                    this.push(this._segment);
                }
                if (this._callback) {
                    this._callback(this._segment);
                }
                if (this.listenerCount('segment') > 0) {
                    this.emit('segment', this._segment);
                }
                this._parseChunk = this._findMoof;
            } else if (this._mdatLength < this._mdatBufferSize) {
                this._setSegment(Buffer.concat([this._moof, ...this._mdatBuffer], (this._moofLength + this._mdatLength)));
                const sliceIndex = this._mdatBufferSize - this._mdatLength;
                delete this._moof;
                delete this._mdatBuffer;
                delete this._moofLength;
                delete this._mdatLength;
                delete this._mdatBufferSize;
                if (this._readableState.pipesCount > 0) {
                    this.push(this._segment);
                }
                if (this._callback) {
                    this._callback(this._segment);
                }
                if (this.listenerCount('segment') > 0) {
                    this.emit('segment', this._segment);
                }
                this._parseChunk = this._findMoof;
                this._parseChunk(chunk.slice(sliceIndex));
            }
        } else {
            const chunkLength = chunk.length;
            if (chunkLength < 8 || chunk[4] !== 0x6D || chunk[5] !== 0x64 || chunk[6] !== 0x61 || chunk[7] !== 0x74) {
                console.log(chunk.slice(0, 20).toString());
                throw new Error('cannot find mdat');
            }
            this._mdatLength = chunk.readUInt32BE(0, true);
            if (this._mdatLength > chunkLength) {
                this._mdatBuffer = [chunk];
                this._mdatBufferSize = chunkLength;
            } else if (this._mdatLength === chunkLength) {
                this._setSegment(Buffer.concat([this._moof, chunk], (this._moofLength + chunkLength)));
                delete this._moof;
                delete this._moofLength;
                delete this._mdatLength;
                if (this._readableState.pipesCount > 0) {
                    this.push(this._segment);
                }
                if (this._callback) {
                    this._callback(this._segment);
                }
                if (this.listenerCount('segment') > 0) {
                    this.emit('segment', this._segment);
                }
                this._parseChunk = this._findMoof;
            } else {
                console.log(this._mdatLength, chunkLength);
                throw new Error('mdatLength less than chunkLength');
            }
        }
    }

    _transform(chunk, encoding, callback) {
        this._parseChunk(chunk);
        callback();
    }

    _flush(callback) {
        this._parseChunk = this._findFtyp;
        delete this._mime;
        delete this._initialization;
        delete this._segment;
        delete this._segmentTimestamp;
        delete this._moof;
        delete this._mdatBuffer;
        delete this._moofLength;
        delete this._mdatLength;
        delete this._mdatBufferSize;
        delete this._ftyp;
        delete this._ftypLength;
        callback();
    }
}

module.exports = Mp4Segmenter;

//ffmpeg mp4 fragmenting : -movflags +frag_keyframe+empty_moov+default_base_moof
//outputs file structure : ftyp+moov -> moof+mdat -> moof+mdat -> moof+mdat ...