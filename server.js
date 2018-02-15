// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const app = require('express')();

const http = require('http').Server(app);

const io = require('socket.io')(http/*, {origins: allowedOrigins}*/);

//const { spawn } = require('child_process');

const Mp4Frag = require('mp4frag');

const FR = require('ffmpeg-respawn');

const P2P = require('pipe2pam');

const PD = require('pam-diff');

//const ffmpegPath = require('ffmpeg-static').path;

app.all('/*', function(req, res, next) {
    console.log('req.url', req.url);
    next();
});

//simulated data pulled from db, will add sqlite later todo
const database = [
    {
        id: 'one',
        name: 'front porch',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.4:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.4"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},//for debugging ffmpeg, change loglevel to any correct value other than quiet and it will print to node's stderr since it is marked as inherit
        hlsBase: 'one',
        hlsListSize: 3
    },
    {
        id: 'two',
        name: 'back door',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.5:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.5"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'two',
        hlsListSize: 3
    },
    {
        id: 'three',
        name: 'side porch',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.6:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.6"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'three',
        hlsListSize: 3
    },
    {
        id: 'four',
        name: 'side gate',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.7:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.7"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'four',
        hlsListSize: 3 
    },
    {
        id: 'five',
        name: 'driveway west',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.8:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.8"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'five',
        hlsListSize: 3
    },
    {
        id: 'six',
        name: 'driveway east',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.9:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.9"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'six',
        hlsListSize: 3
    },
    {
        id: 'seven',
        name: 'backyard',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.21:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.21"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'seven',
        hlsListSize: 3
    },
    {
        id: 'eight',
        name: 'dining room',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.22:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.22"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'eight',
        hlsListSize: 3
    },
    {
        id: 'nine',
        name: 'living room',
        params: [
            '-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.23:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.23"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'nine',
        hlsListSize: 3
    },
    {
        id: 'ten',
        name: 'back hallway',
        params: [
            '-loglevel', 'quiet', '-probesize', '8192', '-analyzeduration', '0',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.25:554/user=admin_password=pass_channel=1_stream=1.sdp',
            '-c:a', 'aac', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.25"', '-reset_timestamps', '0', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'ten',
        hlsListSize: 3
    },
    {
        id: 'eleven',
        name: 'garage 1',
        params: [
            '-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=1&stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-1"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'eleven',
        hlsListSize: 3
    },
    {
        id: 'twelve',
        name: 'garage 2',
        params: [
            '-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=2&stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-2"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'twelve',
        hlsListSize: 3
    },
    {
        id: 'thirteen',
        name: 'garage 3',
        params: [
            '-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=3&stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-3"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'thirteen',
        hlsListSize: 3
    },
    {
        id: 'fourteen',
        name: 'garage 4',
        params: [
            '-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000',
            '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=4&stream=1.sdp',
            '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-4"', '-reset_timestamps', '1', 'pipe:1',
            '-an', '-c:v', 'pam', '-pix_fmt', 'gray', '-f', 'image2pipe', '-vf', 'fps=2,scale=640:480', 'pipe:4'
        ],
        //options: {stdio : ['ignore', 'pipe', 'ignore']},
        hlsBase: 'fourteen',
        hlsListSize: 3
    }
];

const streams = {};

for (let i = 0; i < database.length; i++) {
    //create new mp4 segmenter that will create mime, initialization, and segments from data piped from ffmpeg
    const mp4frag = new Mp4Frag({hlsBase: database[i].hlsBase, hlsListSize: database[i].hlsListSize});
    //spawn ffmpeg with stream info and pipe to mp4frag

    const pipe2pam = new P2P();
    const pamDiff = new PD({difference: 12, percent: 10});
    pipe2pam.pipe(pamDiff, {end: false});
    pamDiff.on('diff', (data)=>{
        console.log(database[i].id, data.trigger[0].percent);
    });

    const ffmpeg = new FR(
        {
            //path: ffmpegPath,
            killAfterStall: 10,
            spawnAfterExit: 5,
            reSpawnLimit: 1000,
            params: database[i].params,
            pipes: [
                {stdioIndex: 1, destination: mp4frag},
                {stdioIndex: 4, destination: pipe2pam}
            ],
            exitCallback: mp4frag.resetCache.bind(mp4frag)
        })
        .start();

    /*const ffmpeg = spawn(ffmpegPath, database[i].params, database[i].options)
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
                if (mp4frag.mime) {
                    console.log(`${namespace} : ${mp4frag.mime}`);
                    socket.emit('mime', mp4frag.mime);
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
                if (mp4frag.segment) {
                    socket.emit('segment', mp4frag.segment);
                }
                //add listener for segments being dispatched by mp4frag
                mp4frag.on('segment', onSegment);
            };

            //client request
            const segmentReq = () => {
                if (mp4frag.segment) {
                    socket.emit('segment', mp4frag.segment);
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
            if (mp4frag.m3u8) {
                res.writeHead(200, {'Content-Type': 'application/vnd.apple.mpegurl'});
                res.end(mp4frag.m3u8);
            } else {
                res.sendStatus(503);//todo maybe send 400
            }
        });
        
        app.get(`/init-${database[i].hlsBase}.mp4`, (req, res) => {
            if (mp4frag.initialization) {
                res.writeHead(200, {'Content-Type': 'video/mp4'});
                res.end(mp4frag.initialization);
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

const path = require('path');
const index = path.join(__dirname, '/index.html');
const index2 = path.join(__dirname, '/index2.html');
const playerJs = path.join(__dirname, '/public/player.js');
const playerMinJs = path.join(__dirname, '/public/player.min.js');
const playerCss = path.join(__dirname, '/public/player.css');

app.get('/', (req, res) => {
    res.sendFile(index);
});

app.get('/index.html', (req, res) => {
    res.sendFile(index);
});

app.get('/index2.html', (req, res) => {
    res.sendFile(index2);
});

app.get('/public/player.js', (req, res) => {
    res.sendFile(playerJs);
});

app.get('/public/player.min.js', (req, res) => {
    res.sendFile(playerMinJs);
});

app.get('/public/player.css', (req, res) => {
    res.sendFile(playerCss);
});

http.listen(3000, () => {
    console.log('listening on localhost:3000');
});