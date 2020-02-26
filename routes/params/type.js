const { inspect } = require('util')

const type = (req, res, next, type) => {
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
}

module.exports = type
