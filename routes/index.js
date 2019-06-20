const express = require('express')
const { Writable } = require('stream')
const { inspect } = require('util')

module.exports = (app) => {
  app.disable('x-powered-by')

  app.all('/*', (req, res, next) => {
    // todo verify authenticated and reroute if necessary
    // console.log('req.url', req.url)
    next()
  })

  app.use(express.static('www'))

  app.param('id', (req, res, next, id) => {
    // console.log('parse id')
    const streams = app.locals.streams
    const stream = streams.get(id)
    if (!stream) {
      return res.status(404)
        .end(`stream "${id}" not found`)
    }
    if (!stream.hasOwnProperty('ffmpeg')) {
      return res.status(500)
        .end(`stream "${id}" does not have a valid ffmpeg src`)
    }
    res.locals.id = id
    res.locals.stream = stream
    next()
  })

  app.param('type', (req, res, next, type) => {
    // console.log('parse type')
    const stream = res.locals.stream
    switch (type) {
      case 'mp4' :
        if (!stream.ffmpeg.running) {
          return res.status(503)
            .end(`stream "${res.locals.id}" is currently not running`)
        }
        if (stream.hasOwnProperty('mp4frag')) {
          res.locals.mp4frag = stream.mp4frag
          return next()
        }
        return res.status(404)
          .end(`mp4 type not found for stream ${res.locals.id}`)
      case 'jpeg' :
        if (!stream.ffmpeg.running) {
          return res.status(503)
            .end(`stream "${res.locals.id}" is currently not running`)
        }
        if (stream.hasOwnProperty('pipe2jpeg')) {
          res.locals.pipe2jpeg = stream.pipe2jpeg
          return next()
        }
        return res.status(404)
          .end(`jpeg type not found for stream ${res.locals.id}`)
      case 'cmd' :
        if (stream.hasOwnProperty('ffmpeg')) {
          res.locals.ffmpeg = stream.ffmpeg
          return next()
        }
        return res.status(404)
          .end(`cmd type not found for stream ${res.locals.id}`)
      case 'debug' :
        return res.end(inspect(res.locals.stream, {
          sorted: true,
          showHidden: false,
          compact: false,
          depth: 2,
          colors: false,
          breakLength: 200,
          getters: true
        }))
      default :
        return res.status(404)
          .end(`${type} type not found for stream ${res.locals.id}`)
    }
  })

  app.get('/api/:id/:type/*', (req, res, next) => {
    // trigger the app.param functions
    // console.log('trigger the param parser', req.params.id, req.params.type)
    next()
  })

  app.get('/api/*/jpeg/image.jpeg', (req, res) => {
    // console.log('image jpeg')
    const pipe2jpeg = res.locals.pipe2jpeg
    const jpeg = pipe2jpeg.jpeg
    if (!jpeg) {
      return res.status(503)
        .set('Retry-After', 10)
        .end(`Stream "${res.locals.id}" image.jpeg currently unavailable. Please try again later.`)
    }
    res.status(200)
      .set('Content-Type', 'image/jpeg')
      .end(jpeg)
  })

  app.get('/api/*/jpeg/video.mjpeg', (req, res) => {
    // console.log('video mjpeg')
    const pipe2jpeg = res.locals.pipe2jpeg
    const jpeg = pipe2jpeg.jpeg

    if (!jpeg) {
      return res.status(503)
        .set('Retry-After', 10)
        .end(`Stream "${res.locals.id}" video.mjpeg currently unavailable. Please try again later.`)
    }

    const writable = new Writable({
      write (chunk, encoding, callback) {
        res.write(`Content-Type: image/jpeg\r\nContent-Length: ${chunk.length}\r\n\r\n`)
        res.write(chunk)
        res.write('\r\n--cctv\r\n')
        callback()
      }
    })

    res.status(200)
      .set('Content-Type', 'multipart/x-mixed-replace;boundary=cctv')
      .write('--cctv\r\n')
    writable.write(jpeg, { end: true })
    pipe2jpeg.pipe(writable)

    res.once('close', () => {
      if (pipe2jpeg && writable) {
        pipe2jpeg.unpipe(writable)
      }
      res.end()
    })
  })

  app.get(`/api/*/mp4/video.mp4`, (req, res) => {
    // console.log('video mp4')
    const mp4frag = res.locals.mp4frag
    const init = mp4frag.initialization
    if (!init) {
      return res.status(503)
        .set('Retry-After', 10)
        .end(`Stream "${res.locals.id}" video.mp4 currently unavailable. Please try again later.`)
    }

    res.status(200)
      .set('Content-Type', 'video/mp4')
      .write(init)
    const segment = mp4frag.segment
    if (segment) {
      res.write(segment)
    }
    mp4frag.pipe(res, { end: true })
    res.once('close', () => {
      if (mp4frag) {
        mp4frag.unpipe(res)
      }
      res.end()
    })
  })

  app.get(`/api/*/mp4/playlist.m3u8`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const m3u8 = mp4frag.m3u8
    if (!m3u8) {
      return res.status(503)
        .set('Retry-After', 10)
        .end(`Stream "${res.locals.id}" playlist.m3u8 currently unavailable. Please try again later.`)
    }
    res.status(200)
      .set('Content-Type', 'application/vnd.apple.mpegurl')
      .end(m3u8)
  })

  app.get(`/api/*/mp4/init-[a-zA-Z]+.mp4`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const init = mp4frag.initialization
    if (!init) {
      return res.status(503)
        .set('Retry-After', 10)
        .end(`Stream "${res.locals.id}" init mp4 currently unavailable. Please try again later.`)
    }
    res.status(200)
      .set('Content-Type', 'video/mp4')
      .end(init)
  })

  app.get(`/api/*/mp4/:segment(*.m4s)`, (req, res) => {
    // console.log('named segment', req.params.segment)
    const mp4frag = res.locals.mp4frag
    const segment = mp4frag.getHlsNamedSegment(req.params.segment)
    if (!segment) {
      return res.status(503)
        .end('503 for m4s segment')
    }
    res.status(200)
      .set('Content-Type', 'video/mp4')
      .end(segment)
  })

  app.get(`/api/*/mp4/playlist.m3u8.txt`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const m3u8 = mp4frag.m3u8
    if (!m3u8) {
      return res.status(503)
        .set('Retry-After', 10)
        .end(`Stream "${res.locals.id}" playlist.m3u8 currently unavailable. Please try again later.`)
    }
    res.status(200)
      .set('Content-Type', 'text/plain')
      .end(m3u8)
  })

  app.get('/api/*/cmd/start', (req, res) => {
    const ffmpeg = res.locals.ffmpeg
    if (ffmpeg.running === true) {
      // console.log('ffmpeg already running')
      ffmpeg.start()
    } else {
      // console.log('starting ffmpeg')
      ffmpeg.start()
    }
    res.status(200)
      .end(`ffmpeg running: ${ffmpeg.running}`)
  })

  app.get('/api/*/cmd/stop', (req, res) => {
    const ffmpeg = res.locals.ffmpeg
    if (ffmpeg.running === false) {
      // console.log('ffmpeg already stopped')
      ffmpeg.stop()
    } else {
      // console.log('stopping ffmpeg')
      ffmpeg.stop()
    }
    res.status(200)
      .end(`ffmpeg running: ${ffmpeg.running}`)
  })
}

// todo listen to video player stop and alert all connected streams
