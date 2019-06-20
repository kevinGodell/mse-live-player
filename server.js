const express = require('express')
const Mp4Frag = require('mp4frag')
const FR = require('ffmpeg-respawn')
const P2J = require('pipe2jpeg')
const SocketIO = require('socket.io')
const { path: ffmpegPath } = require('ffmpeg-static')
const { Server } = require('http')
const routes = require('./routes')
const sockets = require('./sockets')
const database = require('./db') // simulated data pulled from db, will add sqlite later todo

const app = express()
const server = new Server(app)
const io = new SocketIO(server, { origins: '*:*', transports: ['websocket'] })/// *, {origins: allowedOrigins} */)
const streams = new Map()

routes(app)

server.on('upgrade', (request, socket, head) => {
  // const pathname = request.url
  // console.log('http upgrade', request.url)
})

app.locals.streams = streams

for (let i = 0; i < database.length; i++) {
  // create new mp4 segmenter that will create mime, initialization, and segments from data piped from ffmpeg
  const mp4frag = new Mp4Frag({ hlsBase: database[i].hlsBase, hlsListSize: database[i].hlsListSize })

  // create new jpeg parser that will keep most recent jpeg in memory with timestamp for client requests
  const pipe2jpeg = new P2J()

  const ffmpeg = new FR(
    {
      path: ffmpegPath,
      logLevel: database[i].logLevel,
      killAfterStall: 10,
      spawnAfterExit: 5,
      reSpawnLimit: Number.POSITIVE_INFINITY,
      params: database[i].params,
      pipes: [
        { stdioIndex: 1, destination: mp4frag },
        { stdioIndex: 4, destination: pipe2jpeg }
      ],
      exitCallback: (code, signal) => {
        console.error('exit', database[i].name, code, signal)
        if (mp4frag) {
          mp4frag.resetCache()
        }
      }
    })
    .start()

  // streams[database[i].id] = { ffmpeg: ffmpeg, mp4frag: mp4frag, pipe2jpeg: pipe2jpeg }
  streams.set(database[i].id, { ffmpeg: ffmpeg, mp4frag: mp4frag, pipe2jpeg: pipe2jpeg })

  // todo move all socket routes out of loop and put at end with matching req.params.id :id

  // generate the /namespaces for io to route video streams
  const namespace = `/${database[i].id}`

  io
    .of(namespace)// accessing "/namespace" of io based on id of stream
    .on('connection', (socket) => { // listen for connection to /namespace
      // console.log(`a user connected to namespace "${namespace}"`)

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
          // console.log(`${namespace} : ${mp4frag.mime}`)
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
        // console.log(`A user disconnected from namespace "${namespace}"`)
      })
    })
}

sockets(io, streams)

// need to be sudo on some systems to use port 80
server.listen(80, () => {
  console.log('listening on localhost:80')
})

module.exports = app
