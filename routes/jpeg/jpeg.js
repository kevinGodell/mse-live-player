const retryAfter = require('../retryAfter')
const { Writable } = require('stream')

const image = (req, res) => {
  const { pipe2jpeg: { jpeg } = {} } = res.locals

  if (!jpeg) {
    return retryAfter(res, 'image.jpeg')
  }

  res.status(200)
    .set('Content-Type', 'image/jpeg')
    .end(jpeg)
}

const video = (req, res) => {
  const { pipe2jpeg } = res.locals
  const { jpeg } = pipe2jpeg
  const writable = new Writable({
    write (chunk, encoding, callback) {
      res.write(`Content-Type: image/jpeg\r\nContent-Length: ${chunk.length}\r\n\r\n`)
      res.write(chunk)
      res.write('\r\n--cctv\r\n')
      callback()
    }
  })

  if (!jpeg) {
    return retryAfter(res, 'video.mjpeg')
  }

  res.status(200)
    .set('Content-Type', 'multipart/x-mixed-replace;boundary=cctv')
    .write('--cctv\r\n')

  writable.write(jpeg)
  pipe2jpeg.pipe(writable)

  res.once('close', () => {
    if (pipe2jpeg && writable) {
      pipe2jpeg.unpipe(writable)
    }
    res.end()
  })
}

module.exports = {
  image,
  video
}
