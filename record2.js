// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict';

const { spawn } = require('child_process');

const Mp4Segmenter = require('mp4frag');

const fs = require('fs');

const bufferedVideo = [];//will hold array of segments other than the init segment

const bufferedVideoLimit = 3;//removed oldest segments when array grows over length 3

let initSegment = null;//populated in the initialized event

const mp4segmenter = new Mp4Segmenter({bufferSize: 5})//no need to pass options to it because not being used to generate m3u8 playlist
    .on('initialized', () => {
        console.log('initialized');
        initSegment = mp4segmenter.initialization;
    });
    /*.on('segment', (segment) => {
        //console.log('segment');
        bufferedVideo.push(segment);
        while (bufferedVideo.length > bufferedVideoLimit) {
            bufferedVideo.shift();//removes oldest segment in list
        }
    });*/

const ffmpegSource = spawn('ffmpeg', [
    '-loglevel', 'quiet', '-probesize', '64', '-analyzeduration', '100000', '-reorder_queue_size', '5', '-rtsp_transport', 'tcp', '-i', 'rtsp://216.4.116.29:554/axis-media/media.3gp', '-an', '-c:v', 'copy', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-metadata', 'title="ip 216.4.116.29"', '-reset_timestamps', '1', 'pipe:1'
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

    //write the fresh segments
    function onSegment(segment) {
        writeStream.write(segment);
    }

    mp4segmenter.on('segment', onSegment);
    
    //create a timer to remove listener and close file being written
    //todo reset timeout if motion is still occurring before timout completes
    setTimeout(() => {

        //remove event lister here
        mp4segmenter.removeListener('segment', onSegment);
        
        writeStream.end();
        
        console.log('file should be complete');
    }, 20000);
}, 10000);