'use strict'

const { Writable } = require('stream')

module.exports = (app) => {
  // todo path.join will be needed for packaging with pkg

  const path = require('path')
  const index = path.join(__dirname, '../index.html')
  const index2 = path.join(__dirname, '../index2.html')
  const index3 = path.join(__dirname, '../index3.html')
  const index4 = path.join(__dirname, '../index4.html')
  const playerJs = path.join(__dirname, '../public/player.js')
  const playerMinJs = path.join(__dirname, '../public/player.min.js')
  const playerCss = path.join(__dirname, '../public/player.css')

    const websocket = path.join(__dirname, '../public/websocket.html')

    app.all('/*', function (req, res, next) {
        // todo verify authenticated and reroute if necessary
        //console.log('req.url', req.url)
        next()
    })

  app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(index)
  })

    app.get('/websocket.html', (req, res) => {
        res.sendFile(websocket)
    })

  app.get('/index2.html', (req, res) => {
    res.sendFile(index2)
  })

  app.get('/index3.html', (req, res) => {
    res.sendFile(index3)
  })

  app.get('/index4.html', (req, res) => {
    res.sendFile(index4)
  })

  app.get('/public/player.js', (req, res) => {
    res.sendFile(playerJs)
  })

  app.get('/public/player.min.js', (req, res) => {
    res.sendFile(playerMinJs)
  })

  app.get('/public/player.css', (req, res) => {
    res.sendFile(playerCss)
  })

  app.param('id', (req, res, next, id) => {
    const streams = app.locals.streams
    const stream = streams.get(id)
    if (stream) {
      res.locals.id = id
      res.locals.stream = stream
      return next()
    }
    res.status(404)
      .end(`stream "${id}" not found`)
  })

  app.param('type', (req, res, next, type) => {
    const stream = res.locals.stream
    switch (type) {
      case 'mp4' :
        if (stream.hasOwnProperty('mp4frag')) {
          res.locals.mp4frag = stream.mp4frag
          return next()
        }
        return res.status(404)
          .end(`mp4 type not found for stream ${res.locals.id}`)
      case 'jpeg' :
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
      default :
        res.status(404)
          .end(`${type} type not found for stream ${res.locals.id}`)
    }
  })

  app.get('/api/:id([a-zA-Z]+)/:type/*', (req, res, next) => {
    // trigger the app.param functions
    next()
  })

  app.get('/api/[a-zA-Z]+/jpeg/image.jpeg', (req, res) => {
    const pipe2jpeg = res.locals.pipe2jpeg
    const jpeg = pipe2jpeg.jpeg
    if (!jpeg) {
        res.status(503)
            .set('Retry-After',  10)
            .end(`Stream "${res.locals.id}" image.jpeg currently unavailable. Please try again later.`)
    }
      return res.status(200)
          .set('Content-Type', 'image/jpeg')
          .end(jpeg)
  })

  app.get('/api/[a-zA-Z]+/jpeg/video.mjpeg', (req, res) => {
    const pipe2jpeg = res.locals.pipe2jpeg
    const jpeg = pipe2jpeg.jpeg

      if (!jpeg) {
        return res.status(503)
            .set('Retry-After',  10)
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

  app.get(`/api/[a-zA-Z]+/mp4/video.mp4`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const init = mp4frag.initialization
    if (!init) {
        return res.status(503)
            .set('Retry-After',  10)
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

  app.get(`/api/[a-zA-Z]+/mp4/playlist.m3u8`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const m3u8 = mp4frag.m3u8
    if (!m3u8) {
       return res.status(503)
            .set('Retry-After',  10)
            .end(`Stream "${res.locals.id}" playlist.m3u8 currently unavailable. Please try again later.`)
    }
      res.status(200)
        .set('Content-Type', 'application/vnd.apple.mpegurl')
        .end(m3u8)

  })

  app.get(`/api/[a-zA-Z]+/mp4/init-[a-zA-Z]+.mp4`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const init = mp4frag.initialization
    if (!init) {
      return res.status(503)
          .set('Retry-After',  10)
          .end(`Stream "${res.locals.id}" init mp4 currently unavailable. Please try again later.`)
    }
      res.status(200)
          .set('Content-Type', 'video/mp4')
          .end(init)
  })

  app.get(`/api/[a-zA-Z]+/mp4/([a-z]+):segment(\\d+).m4s`, (req, res) => {
    const mp4frag = res.locals.mp4frag
    const segment = mp4frag.getHlsSegment(req.params.segment)
    if (!segment) {
        return res.status(503)
            .end('503 for m4s segment')
    }
      res.status(200)
          .set('Content-Type', 'video/mp4')
          .end(segment)

  })

  app.get(`/api/[a-zA-Z]+/mp4/playlist.m3u8.txt`, (req, res) => {
      const mp4frag = res.locals.mp4frag
      const m3u8 = mp4frag.m3u8
      if (!m3u8) {
          return res.status(503)
              .set('Retry-After',  10)
              .end(`Stream "${res.locals.id}" playlist.m3u8 currently unavailable. Please try again later.`)
      }
      res.status(200)
          .set('Content-Type', 'test/plain')
          .end(m3u8)
  })

  app.get('/api/[a-zA-Z]+/cmd/start', (req, res) => {
      const ffmpeg = res.locals.ffmpeg
      if (ffmpeg.running === true) {
          console.log('ffmpeg already running')
          ffmpeg.start()
      } else {
          console.log('starting ffmpeg')
          ffmpeg.start()
      }
      res.status(200)
          .end(`ffmpeg running: ${ffmpeg.running}`)
  })

  app.get('/api/[a-zA-Z]+/cmd/stop', (req, res) => {
      const ffmpeg = res.locals.ffmpeg
      if (ffmpeg.running === false) {
          console.log('ffmpeg already stopped')
          ffmpeg.stop()
      } else {
          console.log('stopping ffmpeg')
          ffmpeg.stop()
      }
      res.status(200)
          .end(`ffmpeg running: ${ffmpeg.running}`)
  })
}

// todo listen to video player stop and alert all connected streams