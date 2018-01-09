// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const { spawn } = require('child_process');

const Mp4Frag = require('mp4frag');

const mp4frag = new Mp4Frag({bufferListSize: 5})
    .once('initialized', () => {
        console.log('initialized');
    });

const ffmpegSource = spawn('ffmpeg', [
    '-loglevel', 'quiet', '-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://131.95.3.162:554/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 131.95.3.162"', '-reset_timestamps', '1', 'pipe:1'
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
    
    //spawn new ffmpeg process to use as recorder
    let recorder = spawn(
        'ffmpeg', 
        ['-loglevel', 'debug', '-f', 'mp4', '-i', 'pipe:0', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+faststart+frag_keyframe', `${Date.now()}.mp4`],
        {stdio : ['pipe', 'ignore', 'inherit']}
    );

    //write the init fragment AND buffered segments
    recorder.stdio[0].write(mp4frag.bufferConcat);

    //start piping live segments to continue recording
    mp4frag.pipe(recorder.stdio[0]);
    
    //create a timer to cancel ffmpeg process
    //todo reset timeout if motion is still occurring before timeout completes
    setTimeout(() => {
        
        //unpipe or will throw error if killing process while piping
        mp4frag.unpipe(recorder.stdio[0]);
        
        //close writing to stdin should close process
        recorder.stdio[0].end();
        
        //remove reference
        recorder = null;
        console.log('recorder should be dead');
    }, 10000);
}, 10000);