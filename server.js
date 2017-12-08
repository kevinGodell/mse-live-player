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
        id: 'one',
        name: 'front porch',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.4:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.4"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}//for debugging ffmpeg, change loglevel to any correct value other than quiet and it will print to node's stderr since it is marked as inherit
    },
    {
        id: 'two',
        name: 'back door',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.5:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.5"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}

    },
    {
        id: 'three',
        name: 'side porch',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.6:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.6"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'four',
        name: 'side gate',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.7:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.7"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'five',
        name: 'driveway west',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.8:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.8"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'six',
        name: 'driveway east',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.9:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.9"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'seven',
        name: 'backyard',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.21:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.21"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'eight',
        name: 'dining room',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.22:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.22"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'nine',
        name: 'living room',
        params: ['-loglevel', 'quiet', '-probesize', '32', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.23:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.23"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'ten',
        name: 'back hallway',
        params: ['-loglevel', 'quiet', '-probesize', '8192', '-analyzeduration', '0', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.25:554/user=admin_password=pass_channel=1_stream=1.sdp', /*'-an',*/'-c:a', 'aac', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.25"', '-reset_timestamps', '0', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'eleven',
        name: 'garage 1',
        params: ['-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=1&stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-1"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'twelve',
        name: 'garage 2',
        params: ['-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=2&stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-2"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'thirteen',
        name: 'garage 3',
        params: ['-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '100000000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=3&stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-3"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'ignore']}
    },
    {
        id: 'fourteen',
        name: 'garage 4',
        params: ['-loglevel', 'quiet', '-probesize', '1024', '-analyzeduration', '10000000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.18:554/user=admin&password=pass&channel=4&stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset', '-metadata', 'title="ip 192.168.1.18-4"', '-reset_timestamps', '1', 'pipe:1'],
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
    res.sendFile(__dirname + '/index.html');
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

http.listen(3000, () => {
    console.log('listening on localhost:3000');
});