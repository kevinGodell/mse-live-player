// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const { spawn } = require('child_process');

const Mp4Frag = require('mp4frag');

const fs = require('fs');

const mp4frag = new Mp4Frag({bufferListSize: 3})//bufferSize = number of media segments of past video to store
    .once('initialized', () => {
        console.log('initialized');
    });

const ffmpegSource = spawn('ffmpeg', [
    '-loglevel', 'quiet', '-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://192.168.1.22:554/user=admin_password=pass_channel=1_stream=1.sdp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 192.168.1.22"', '-reset_timestamps', '1', 'pipe:1'
])
    .on('error', (error) => {
        console.log('error', error);
    })
    .on('exit', (code, signal) => {
        console.log('exit', code, signal);
    })
    .stdio[1].pipe(mp4frag);


//simulate a motion trigger that occurs at later point in time
setTimeout(()=> {
    console.log('simulated motion trigger');

    const writeStream = fs.createWriteStream(`${Date.now()}.mp4`);

    //mp4frag.bufferConcat has the init fragment and buffered segments combined into a single Buffer
    writeStream.write(mp4frag.bufferConcat);

    //start piping live segments to the writer
    mp4frag.pipe(writeStream);
    
    //create a timer to remove listener and close file being written
    //todo reset timeout if motion is still occurring before timout completes
    setTimeout(() => {
        
        mp4frag.unpipe(writeStream);
        
        writeStream.end();
        
        console.log('file should be complete');
    }, 20000);
}, 10000);