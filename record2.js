// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const { spawn } = require('child_process');

const Mp4Segmenter = require('mp4frag');

const fs = require('fs');

const mp4segmenter = new Mp4Segmenter({bufferSize: 3})//bufferSize = number of media segments of past video to store
    .on('initialized', () => {
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
    .stdio[1].pipe(mp4segmenter);


//simulate a motion trigger that occurs at later point in time
setTimeout(()=> {
    console.log('simulated motion trigger');

    const writeStream = fs.createWriteStream(`${Date.now()}.mp4`);

    //write in the beginning of mp4 file
    writeStream.write(mp4segmenter.initialization);

    //write the saved segments
    writeStream.write(mp4segmenter.buffer);

    mp4segmenter.pipe(writeStream);

    /*
    //write the fresh segments
    function onSegment(segment) {
        writeStream.write(segment);
    }

    mp4segmenter.on('segment', onSegment);
    */
    
    //create a timer to remove listener and close file being written
    //todo reset timeout if motion is still occurring before timout completes
    setTimeout(() => {

        //remove event lister here
        //mp4segmenter.removeListener('segment', onSegment);
        
        mp4segmenter.unpipe(writeStream);
        
        writeStream.end();
        
        console.log('file should be complete');
    }, 20000);
}, 20000);