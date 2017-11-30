// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const app = require('express')();

const http = require('http').Server(app);

const io = require('socket.io')(http/*, {origins: allowedOrigins}*/);

const { spawn } = require('child_process');

const Mp4Segmenter = new require('./Mp4Segmenter');

//simulated data pulled from db, will add sqlite later todo
const database = [
    {
        id: 'starbucks',
        name: 'starbucks coffee sucks',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://131.95.3.162/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 131.95.3.162"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    }
];

const streams = {};

for (let i = 0; i < database.length; i++) {
    //create new mp4 segmenter that will head codec, init, and segments from data pipe from ffmpeg
    const mp4segmenter = new Mp4Segmenter();
    //spawn ffmpeg with stream info and pipe to mp4segmenter
    const ffmpeg = spawn('ffmpeg', database[i].params, database[i].options)
        .on('error', (error) => {
            console.log(database[i].name, 'error', error);
        })
        .on('exit', (code, signal) => {
            console.log(database[i].name, 'exit', code, signal);
        })
        .stdio[1].pipe(mp4segmenter);

    streams[database[i].id] = {ffmpeg: ffmpeg, mp4segmenter: mp4segmenter};

    //generate the /namespaces for io to route video streams
    io
        .of(`/${database[i].id}`)//accessing "/namespace" of io based on id of stream
        .on('connection', (socket) => {//listen for connection to /namespace
            console.log(`a user connected to namespace "/${database[i].id}"`);


            //event listener
            const onInit = () => {
                socket.emit('mime', mp4segmenter.mimeType);
                mp4segmenter.removeListener('ready', onInit);
            };

            //event listener
            const onSegment = (data) => {
                socket.emit('segment', data);
                //console.log('emit segment', data.length);
            };

            //client request
            const mime = () => {
                if (mp4segmenter.mimeType) {
                    socket.emit('mime', mp4segmenter.mimeType);
                } else {
                    mp4segmenter.on('init', onInit);
                }
            };

            //client request
            const init = () => {
                socket.emit('init', mp4segmenter.initSegment);
            };

            //client request
            const segment = () => {
                //add listener for segments being dispatched by mp4segmenter
                mp4segmenter.on('segment', onSegment);
            };

            //client request
            const pause = () => {//same as stop, for now. may need other logic todo
                mp4segmenter.removeListener('segment', onSegment);
            };

            //client request
            const resume = () => {//same as segment, for now. may need other logic todo
                mp4segmenter.on('segment', onSegment);
                //may indicate that we are resuming from paused
            };

            //client request
            const stop = () => {
                mp4segmenter.removeListener('segment', onSegment);
                //may have to remove other listeners if client requests to stop before asking for segments
                //stop might indicate that we will not request anymore data todo
            };

            //listen to client messages
            socket.on('message', (msg) => {
                console.log(msg);
                switch (msg) {
                    case 'mime' ://client is requesting mime
                        mime();
                        break;
                    case 'init' ://client is requesting init segment
                        init();
                        break;
                    case 'segment' ://client is requesting segments
                        segment();
                        break;
                    case 'pause' :
                        pause();
                        break;
                    case 'resume' :
                        resume();
                        break;
                    case 'stop' ://client requesting to stop receiving segments
                        stop();
                        break;
                }
            });

            socket.on('disconnect', () => {
                stop();
                console.log(`A user disconnected from namespace "/${database[i].id}"`);
            });

        });
}

//streams are available via streams['abc'] or streams.abc where 'abc' is the assigned id

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/compare.html');
});

app.get('/public/player.js', (req, res) => {
    res.sendFile(__dirname + '/public/player.js');
});

app.get('/starbucks.mp4', (req, res) => {
    if (!streams.starbucks.mp4segmenter.initSegment) {
        //browser may have requested init segment before it was ready
        res.status(503);
        res.end('resource not ready');
    } else {
        res.status(200);
        res.write(streams.starbucks.mp4segmenter.initSegment);
        streams.starbucks.mp4segmenter.pipe(res);
        res.on('close', () => {
            streams.starbucks.mp4segmenter.unpipe(res);
        });
    }
});

http.listen(3000, () => {
    console.log('listening on localhost:3000');
});

//rtsp://131.95.3.162/axis-media/media.3gp