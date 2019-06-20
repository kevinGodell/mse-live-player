const middleware = (req, res, next, id, app) => {
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
}

const id = (app) => (...params) => middleware(...params, app)

module.exports = id
