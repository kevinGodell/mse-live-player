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
        id: 'one',
        name: 'front porch',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.4:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.4"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}//for debugging ffmpeg, change loglevel to any correct value other than quiet and it will print to node's stderr since it is marked as inherit
    },
    {
        id: 'two',
        name: 'back door',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.5:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.5"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}

    },
    {
        id: 'three',
        name: 'side porch',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.6:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.6"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'four',
        name: 'side gate',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.7:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.7"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'five',
        name: 'driveway west',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.8:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.8"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'six',
        name: 'driveway east',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.9:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.9"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'seven',
        name: 'backyard',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.21:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.21"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'eight',
        name: 'dining room',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.22:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.22"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'nine',
        name: 'living room',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.23:554/user=admin_password=pass_channel=1_stream=0.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.23"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
    },
    {
        id: 'ten',
        name: 'back hallway',
        params: ['-loglevel', 'quiet', '-probesize', '32000', '-analyzeduration', '100000000', '-reorder_queue_size', '0', '-rtsp_transport', 'tcp', '-i', 'rtsp://131.95.3.162/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 131.95.3.162"', '-reset_timestamps', '1', 'pipe:1'],
        options: {stdio : ['ignore', 'pipe', 'inherit']}
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

            const mime = () => {
                socket.emit('mime', mp4segmenter.mimeType);
            };

            const emitSegment = (data) => {
                socket.emit('segment', data);
                //console.log('emit segment', data.length);
            };

            const init = () => {
                socket.emit('init', mp4segmenter.initSegment);
            };

            const segment = () => {
                //console.log('segment');
                mp4segmenter.on('segment', emitSegment);
            };

            const pause = () => {//same as stop, for now. may need other logic todo
                mp4segmenter.removeListener('segment', emitSegment);
            };

            const resume = () => {//same as segment, for now. may need other logic todo
                mp4segmenter.on('segment', emitSegment);
                //may indicate that we are resuming from paused
            };

            const stop = () => {
                mp4segmenter.removeListener('segment', emitSegment);
                //stop might indicate that we will not request anymore data todo
            };

            socket.on('message', (msg) => {
                console.log(msg);
                switch (msg) {
                    case 'mime' :
                        mime();
                        break;
                    case 'init' :
                        init();
                        break;
                    case 'segment' :
                        segment();
                        break;
                    case 'pause' :
                        pause();
                        break;
                    case 'resume' :
                        resume();
                        break;
                    case 'stop' :
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

//streams are available via streams['abc'] where 'abc' is the assigned id

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});


app.get('/public/player.js', (req, res) => {
    res.sendFile(__dirname + '/public/player.js');
});

http.listen(3000, () => {
    console.log('listening on localhost:3000');
});

//rtsp://131.95.3.162/axis-media/media.3gp