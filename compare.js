// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const app = require('express')();

const http = require('http').Server(app);

const io = require('socket.io')(http/*, {origins: allowedOrigins}*/);

const { spawn } = require('child_process');

const Mp4Segmenter = require('./Mp4Segmenter');

//simulated data pulled from db, will add sqlite later todo
const database = [
    {
        id: 'starbucks',
        name: 'starbucks coffee',
        params: ['-loglevel', 'quiet', '-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://131.95.3.162:554/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 131.95.3.162"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'pool',
        name: 'resort pool',
        params: ['-loglevel', 'quiet', '-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://216.4.116.29:554/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 131.95.3.162"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    }
];

const streams = {};

for (let i = 0; i < database.length; i++) {
    //create new mp4 segmenter that will create mime, initialization, and segments from data piped from ffmpeg
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
    const namespace = `/${database[i].id}`;

    io
        .of(namespace)//accessing "/namespace" of io based on id of stream
        .on('connection', (socket) => {//listen for connection to /namespace
            console.log(`a user connected to namespace "${namespace}"`);

            //event listener
            const onInitialized = () => {
                socket.emit('mime', mp4segmenter.mime);
                mp4segmenter.removeListener('initialized', onInitialized);
            };

            //event listener
            const onSegment = (data) => {
                socket.emit('segment', data);
                //console.log('emit segment', data.length);
            };

            //client request
            const mimeReq = () => {
                if (mp4segmenter.mime) {
                    console.log(`${namespace} : ${mp4segmenter.mime}`);
                    socket.emit('mime', mp4segmenter.mime);
                } else {
                    mp4segmenter.on('initialized', onInitialized);
                }
            };

            //client request
            const initializationReq = () => {
                socket.emit('initialization', mp4segmenter.initialization);
            };

            //client request
            const segmentsReq = () => {
                //send current segment first to start video asap
                if (mp4segmenter.segment) {
                    socket.emit('segment', mp4segmenter.segment);
                }
                //add listener for segments being dispatched by mp4segmenter
                mp4segmenter.on('segment', onSegment);
            };

            //client request
            const segmentReq = () => {
                if (mp4segmenter.segment) {
                    socket.emit('segment', mp4segmenter.segment);
                } else {
                    mp4segmenter.once('segment', onSegment);
                }
            };

            //client request
            const pauseReq = () => {//same as stop, for now. will need other logic todo
                mp4segmenter.removeListener('segment', onSegment);
            };

            //client request
            const resumeReq = () => {//same as segment, for now. will need other logic todo
                mp4segmenter.on('segment', onSegment);
                //may indicate that we are resuming from paused
            };

            //client request
            const stopReq = () => {
                mp4segmenter.removeListener('segment', onSegment);
                mp4segmenter.removeListener('initialized', onInitialized);
                //stop might indicate that we will not request anymore data todo
            };

            //listen to client messages
            socket.on('message', (msg) => {
                console.log(`${namespace} message : ${msg}`);
                switch (msg) {
                    case 'mime' ://client is requesting mime
                        mimeReq();
                        break;
                    case 'initialization' ://client is requesting initialization segment
                        initializationReq();
                        break;
                    case 'segment' ://client is requesting a SINGLE segment
                        segmentReq();
                        break;
                    case 'segments' ://client is requesting ALL segments
                        segmentsReq();
                        break;
                    case 'pause' :
                        pauseReq();
                        break;
                    case 'resume' :
                        resumeReq();
                        break;
                    case 'stop' ://client requesting to stop receiving segments
                        stopReq();
                        break;
                }
            });

            socket.on('disconnect', () => {
                stopReq();
                console.log(`A user disconnected from namespace "${namespace}"`);
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

app.get('/public/player.min.js', (req, res) => {
    res.sendFile(__dirname + '/public/player.min.js');
});

app.get('/public/player.css', (req, res) => {
    res.sendFile(__dirname + '/public/player.css');
});

app.get('/starbucks.mp4', (req, res) => {
    if (!streams.starbucks.mp4segmenter.initialization) {
        //browser may have requested init segment before it was ready
        res.status(503);
        res.end('resource not ready');
    } else {
        res.status(200);
        res.write(streams.starbucks.mp4segmenter.initialization);
        streams.starbucks.mp4segmenter.pipe(res);
        res.on('close', () => {
            streams.starbucks.mp4segmenter.unpipe(res);
        });
    }
});

app.get('/pool.mp4', (req, res) => {
    if (!streams.pool.mp4segmenter.initialization) {
        //browser may have requested init segment before it was ready
        res.status(503);
        res.end('resource not ready');
    } else {
        res.status(200);
        res.write(streams.pool.mp4segmenter.initialization);
        streams.pool.mp4segmenter.pipe(res);
        res.on('close', () => {
            streams.pool.mp4segmenter.unpipe(res);
        });
    }
});

http.listen(3000, () => {
    console.log('listening on localhost:3000');
});