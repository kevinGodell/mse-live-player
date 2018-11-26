// jshint esversion: 6, globalstrict: true, strict: true, bitwise: true, node: true, loopfunc: true

'use strict'

//const WebSocket = require('ws')

const express = require('express')

const app = express()

const routes = require('./routes/routes')

routes(app)

app.disable('x-powered-by')

const http = require('http').Server(app)

http.on('upgrade', function upgrade(request, socket, head) {
    console.log('upgrade')
    const pathname = request
        //console.log('upgrade', pathname)
})

//const wss = new WebSocket.Server({server: http });

/*wss.on('connection', function connection(ws, req) {


    console.log('ws connection')

    ws.on('open', function open(message) {
        console.log('open: %s', message)
    })

    ws.on('close', function open(message) {
        console.log('close: %s', message)
    })

    const ip = req.connection.remoteAddress;

    console.log('ip', ip)

    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
    });

    //ws.send(new ArrayBuffer('something'));

    const jpeg = app.locals.streams.get('one').pipe2jpeg.jpeg

    console.log(jpeg.length)

    //ws.binaryType = 'arraybuffer'

    //ws.binaryType = 'blob'

    //BINARY_TYPES: ['nodebuffer', 'arraybuffer', 'fragments'],
    //ws.binaryType = 'nodebuffer'

    ws.send('jpeg')
    ws.send(jpeg)

    const pipe2jpeg = app.locals.streams.get('one').pipe2jpeg

    const send = data => {
        ws.send(data)
    }

    pipe2jpeg.on('jpeg', send);

    ws.once('close', ()=> {
        console.log('close ws and remove listener')
        console.log(pipe2jpeg.listeners('jpeg'))
        pipe2jpeg.removeListener('jpeg', send)
        console.log(pipe2jpeg.listeners('jpeg'))
        pipe2jpeg.removeListener('jpeg', send)
    })

   // ws.emit('hello')

});*/

const io = require('socket.io')(http/*, {origins: allowedOrigins} */)

io.on('connect', (data) => {
  console.log('io connect', data)

})

const Mp4Frag = require('mp4frag')

const FR = require('ffmpeg-respawn')

const P2J = require('pipe2jpeg')

const ffmpegPath = require('ffmpeg-static').path

// simulated data pulled from db, will add sqlite later todo
const database = require('./db')

const streams = new Map()

app.locals.streams = streams

for (let i = 0; i < database.length; i++) {
  // create new mp4 segmenter that will create mime, initialization, and segments from data piped from ffmpeg
  const mp4frag = new Mp4Frag({ hlsBase: database[i].hlsBase, hlsListSize: database[i].hlsListSize })

  // create new jpeg parser that will keep most recent jpeg in memory with timestamp for client requests
  const pipe2jpeg = new P2J()

  const ffmpeg = new FR(
    {
      path: ffmpegPath,
      killAfterStall: 10,
      spawnAfterExit: 5,
      reSpawnLimit: 10000,
      params: database[i].params,
      pipes: [
        { stdioIndex: 1, destination: mp4frag },
        { stdioIndex: 4, destination: pipe2jpeg }
      ],
      exitCallback: mp4frag.resetCache.bind(mp4frag)
    })
    .start()

  //streams[database[i].id] = { ffmpeg: ffmpeg, mp4frag: mp4frag, pipe2jpeg: pipe2jpeg }
  streams.set(database[i].id, { ffmpeg: ffmpeg, mp4frag: mp4frag, pipe2jpeg: pipe2jpeg })

  // todo move all socket routes out of loop and put at end with matching req.params.id :id

  // generate the /namespaces for io to route video streams
  const namespace = `/${database[i].id}`

  io
    .of(namespace)// accessing "/namespace" of io based on id of stream
    .on('connection', (socket) => { // listen for connection to /namespace
      //console.log(`a user connected to namespace "${namespace}"`)

      // event listener
      const onInitialized = () => {
        socket.emit('mime', mp4frag.mime)
        mp4frag.removeListener('initialized', onInitialized)
      }

      // event listener
      const onSegment = (data) => {
        socket.emit('segment', data)
        // console.log('emit segment', data.length);
      }

      // client request
      const mimeReq = () => {
        if (mp4frag.mime) {
          //console.log(`${namespace} : ${mp4frag.mime}`)
          socket.emit('mime', mp4frag.mime)
        } else {
          mp4frag.on('initialized', onInitialized)
        }
      }

      // client request
      const initializationReq = () => {
        socket.emit('initialization', mp4frag.initialization)
      }

      // client request
      const segmentsReq = () => {
        // send current segment first to start video asap
        if (mp4frag.segment) {
          socket.emit('segment', mp4frag.segment)
        }
        // add listener for segments being dispatched by mp4frag
        mp4frag.on('segment', onSegment)
      }

      // client request
      const segmentReq = () => {
        if (mp4frag.segment) {
          socket.emit('segment', mp4frag.segment)
        } else {
          mp4frag.once('segment', onSegment)
        }
      }

      // client request
      const pauseReq = () => { // same as stop, for now. will need other logic todo
        mp4frag.removeListener('segment', onSegment)
      }

      // client request
      const resumeReq = () => { // same as segment, for now. will need other logic todo
        mp4frag.on('segment', onSegment)
        // may indicate that we are resuming from paused
      }

      // client request
      const stopReq = () => {
        mp4frag.removeListener('segment', onSegment)
        mp4frag.removeListener('initialized', onInitialized)
        // stop might indicate that we will not request anymore data todo
      }

      // listen to client messages
      socket.on('message', (msg) => {
       // console.log(`${namespace} message : ${msg}`)
        switch (msg) {
          case 'mime' :// client is requesting mime
            mimeReq()
            break
          case 'initialization' :// client is requesting initialization segment
            initializationReq()
            break
          case 'segment' :// client is requesting a SINGLE segment
            segmentReq()
            break
          case 'segments' :// client is requesting ALL segments
            segmentsReq()
            break
          case 'pause' :
            pauseReq()
            break
          case 'resume' :
            resumeReq()
            break
          case 'stop' :// client requesting to stop receiving segments
            stopReq()
            break
        }
      })

      socket.on('disconnect', () => {
        stopReq()
        //console.log(`A user disconnected from namespace "${namespace}"`)
      })
    })

}

http.listen(80, () => {
  console.log('listening on localhost:8080')
})

module.exports = app