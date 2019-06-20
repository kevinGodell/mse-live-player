'use strict';

const app = require('express')();

const http = require('http').Server(app);

const io = require('socket.io')(http/*, {origins: allowedOrigins}*/);

//const { spawn } = require('child_process');

const Mp4Frag = require('mp4frag');

const FfmpegRespawn = require('ffmpeg-respawn');

const ffmpegPath = require('ffmpeg-static').path;

//simulated data pulled from db, will add sqlite later todo
const database = [
    {
        id: 'starbucks',
        name: 'starbucks coffee',
        params: [/*'-loglevel', 'quiet', */'-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://131.95.3.162:554/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 131.95.3.162"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'starbucks',
        hlsListSize: 3
    }
    /*,{
        id: 'pool',
        name: 'resort pool',
        params: ['-loglevel', 'quiet', '-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://216.4.116.29:554/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 216.4.116.29"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'pool',
        hlsListSize: 3
    }*/
];

const streams = {};

for (let i = 0; i < database.length; i++) {
    //create new mp4 segmenter that will create mime, initialization, and segments from data piped from ffmpeg
    const mp4frag = new Mp4Frag({hlsBase: database[i].hlsBase, hlsListSize: database[i].hlsListSize});
    //spawn ffmpeg with stream info and pipe to mp4frag

    const ffmpeg = new FfmpegRespawn(
        {
            path: ffmpegPath,
            killAfterStall: 10,
            spawnAfterExit: 5,
            reSpawnLimit: 1000,
            params: database[i].params,
            pipes: [
                {stdioIndex: 1, destination: mp4frag}
                ],
            exitCallback: mp4frag.resetCache.bind(mp4frag)
        })
        .start();

    /*const ffmpeg = spawn('ffmpeg', database[i].params, database[i].options)
    //todo monitor ffmpeg and respawn if necessary
        .on('error', (error) => {
            console.log(database[i].name, 'error', error);
        })
        .on('exit', (code, signal) => {
            console.log(database[i].name, 'exit', code, signal);
        })
        .stdio[1].pipe(mp4frag);*/

    streams[database[i].id] = {ffmpeg: ffmpeg, mp4frag: mp4frag};

    //generate the /namespaces for io to route video streams
    const namespace = `/${database[i].id}`;

    io
        .of(namespace)//accessing "/namespace" of io based on id of stream
        .on('connection', (socket) => {//listen for connection to /namespace
            console.log(`a user connected to namespace "${namespace}"`);

            //event listener
            const onInitialized = () => {
                socket.emit('mime', mp4frag.mime);
                mp4frag.removeListener('initialized', onInitialized);
            };

            //event listener
            const onSegment = (data) => {
                socket.emit('segment', data);
                //console.log('emit segment', data.length);
            };

            //client request
            const mimeReq = () => {
                const mime = mp4frag.mime;
                if (mime) {
                    console.log(`${namespace} : ${mime}`);
                    socket.emit('mime', mime);
                } else {
                    mp4frag.on('initialized', onInitialized);
                }
            };

            //client request
            const initializationReq = () => {
                socket.emit('initialization', mp4frag.initialization);
            };

            //client request
            const segmentsReq = () => {
                //send current segment first to start video asap
                const segment = mp4frag.segment;
                if (segment) {
                    socket.emit('segment', segment);
                }
                //add listener for segments being dispatched by mp4frag
                mp4frag.on('segment', onSegment);
            };

            //client request
            const segmentReq = () => {
                const segment = mp4frag.segment;
                if (segment) {
                    socket.emit('segment', segment);
                } else {
                    mp4frag.once('segment', onSegment);
                }
            };

            //client request
            const pauseReq = () => {//same as stop, for now. will need other logic todo
                mp4frag.removeListener('segment', onSegment);
            };

            //client request
            const resumeReq = () => {//same as segment, for now. will need other logic todo
                mp4frag.on('segment', onSegment);
                //may indicate that we are resuming from paused
            };

            //client request
            const stopReq = () => {
                mp4frag.removeListener('segment', onSegment);
                mp4frag.removeListener('initialized', onInitialized);
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

    if (database[i].hlsBase) {

        app.get(`/${database[i].hlsBase}.m3u8`, (req, res) => {
            const m3u8 = mp4frag.m3u8;
            if (m3u8) {
                res.writeHead(200, {'Content-Type': 'application/vnd.apple.mpegurl'});
                res.end(m3u8);
            } else {
                res.sendStatus(503);//todo maybe send 400
            }
        });

        app.get(`/init-${database[i].hlsBase}.mp4`, (req, res) => {
            const init = mp4frag.initialization;
            if (init) {
                res.writeHead(200, {'Content-Type': 'video/mp4'});
                res.end(init);
            } else {
                res.sendStatus(503);
            }
        });

        app.get(`/${database[i].hlsBase}:id.m4s`, (req, res) => {
            const segment = mp4frag.getHlsSegment(req.params.id);
            if (segment) {
                res.writeHead(200, {'Content-Type': 'video/mp4'});
                res.end(segment);
            } else {
                res.sendStatus(503);
            }
        });
    }
}

//streams are available via streams['abc'] or streams.abc where 'abc' is the assigned id

//adding path so that "pkg" can detect source files for packaging
const path = require('path');
console.log(path.join(__dirname, '/compare.html'));
console.log(path.join(__dirname, '/www/player/player.js'));
console.log(path.join(__dirname, '/www/player/player.min.js'));
console.log(path.join(__dirname, '/www/player/player.css'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/compare.html');
});

app.get('/public/player.js', (req, res) => {
    res.sendFile(__dirname + '/www/player/player.js');
});

app.get('/public/player.min.js', (req, res) => {
    res.sendFile(__dirname + '/www/player/player.min.js');
});

app.get('/public/player.css', (req, res) => {
    res.sendFile(__dirname + '/www/player/player.css');
});

app.get('/starbucks.mp4', (req, res) => {
    const init = streams.starbucks.mp4frag.initialization;
    if (!init) {
        //browser may have requested init segment before it was ready
        res.status(503);
        res.end('resource not ready');
    } else {
        res.status(200);
        res.write(init);
        streams.starbucks.mp4frag.pipe(res);
        res.on('close', () => {
            streams.starbucks.mp4frag.unpipe(res);
        });
    }
});

/*app.get('/pool.mp4', (req, res) => {
    const init = streams.pool.mp4frag.initialization;
    if (!init) {
        //browser may have requested init segment before it was ready
        res.status(503);
        res.end('resource not ready');
    } else {
        res.status(200);
        res.write(init);
        streams.pool.mp4frag.pipe(res);
        res.on('close', () => {
            streams.pool.mp4frag.unpipe(res);
        });
    }
});*/

http.listen(3000, () => {
    console.log('listening on localhost:3000');
});
