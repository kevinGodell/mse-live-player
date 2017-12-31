// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const { spawn } = require('child_process');

const Mp4Segmenter = require('./Mp4Segmenter');

const bufferedVideo = [];//will hold array of segments other than the init segment

const bufferedVideoLimit = 3;//removed oldest segments when array grows over length 3

let initSegment = null;//populated in the initialized event

const mp4segmenter = new Mp4Segmenter()//no need to pass options to it because not being used to generate m3u8 playlist
    .on('initialized', () => {
        console.log('initialized');
        initSegment = mp4segmenter.initialization;
    })
    .on('segment', (segment) => {
        console.log('segment');
        bufferedVideo.push(segment);
        while (bufferedVideo.length > bufferedVideoLimit) {
            bufferedVideo.shift();//removes oldest segment in list
        }
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
    .stdio[1].pipe(mp4segmenter);


//simulate a motion trigger that occurs at later point in time
setTimeout(()=> {
    console.log('simulated motion trigger');
    
    //spawn new ffmpeg process to use as recorder
    let recorder = spawn('ffmpeg', ['-f', 'mp4', '-i', 'pipe:0', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+faststart+frag_keyframe', `${Date.now()}.mp4`]);//tell ffmpeg that input is mp4 because it may not be able to guess correctly
    
    //write the initialization segment first
    recorder.stdio[0].write(initSegment);
    
    //loop throught the buffered segments in array and write them
    for (let i = 0; i < bufferedVideo.length; i++) {
        recorder.stdio[0].write(bufferedVideo[i]);
    }
    
    //start piping live segments to continue recording
    mp4segmenter.pipe(recorder.stdio[0]);
    
    /* or */
    
    //listen for segment event and do something with segment
    /*function onSeg(segment) {
        recorder.stdio[0].write(segment);
    }

    mp4segmenter.on('segment', onSeg);*/
    
    //create a timer to cancel ffmpeg process
    //todo reset timeout if motion is still occurring before timout completes
    setTimeout((proc) => {
        
        mp4segmenter.unpipe(recorder.stdio[0]);

        //remove event lister here
        //mp4segmenter.removeListener('segment', onSeg);
        
        recorder.stdio[0].end('q');
        
        recorder = null;
        console.log('recorder should be dead');
    }, 20000);
}, 10000);