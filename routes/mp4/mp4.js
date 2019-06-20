const retryAfter = require('../retryAfter')

const playlist = (req, res) => {
  const { mp4frag: { m3u8 } = {}, sendText } = res.locals

  if (!m3u8) {
    return retryAfter(res, 'playlist.m3u8')
  }
  res.status(200)
    .set('Content-Type', sendText ? 'text/plain' : 'application/vnd.apple.mpegurl')
    .end(m3u8)
}

const segment = (req, res) => {
  const { mp4frag } = res.locals
  const segment = mp4frag && mp4frag.getHlsNamedSegment(req.params.segment)

  if (!segment) {
    return res.status(503)
      .end('503 for m4s segment')
  }
  res.status(200)
    .set('Content-Type', 'video/mp4')
    .end(segment)
}

const setLocals = locals => (req, res, next) => {
  res.locals = { ...res.locals, ...locals }
  next()
}

const video = (req, res) => {
  const { initOnly, mp4frag } = res.locals
  const { initialization, segment } = mp4frag

  if (!initialization) {
    return retryAfter(res, 'init mp4')
  }

  res.status(200)
    .set('Content-Type', 'video/mp4')
    .write(initialization)

  if (initOnly) {
    return res.end()
  }

  segment && res.write(segment)
  mp4frag.pipe(res, { end: true })

  res.once('close', () => {
    mp4frag && mp4frag.unpipe(res)
    res.end()
  })
}

module.exports = {
  playlist,
  segment,
  setLocals,
  video
}
