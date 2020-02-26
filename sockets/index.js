// const { inspect } = require('util')

module.exports = (io, streams) => {
  // middleware, gets called first
  io.use((socket, next) => {
    // const query = socket.handshake.query
    // console.log('socket use', inspect(socket.adapter.nsp, { sorted: true, showHidden: false, compact: false, depth: 0, colors: false, breakLength: 200, getters: true}))
    // process.exit();
    next()
  })

  // gets called second
  io.on('connect', socket => {
    // console.log('socket connect')
    // const query = socket.handshake.query
  })

  // gets called third
  io.on('connection', socket => {
    // console.log('connection')
    // const query = socket.handshake['query'];
  })

  // todo check event connect too
  // gets called last, if matches namespace
  io.of('/api').on('connection', (socket) => {
    const query = socket.handshake.query
    // console.log('api', query.id, query.type, io.app)

    const stream = streams.get(query.id)

    // console.log('id', query.id)

    if (!stream) {
      socket.binary(false).emit('message', { status: 'error', msg: `stream id "${query.id}" not found` })
      // todo return disconnect
    }

    if (!stream.hasOwnProperty('ffmpeg')) {
      socket.binary(false).emit('message', { status: 'error', msg: `stream id "${query.id}" does not have a valid ffmpeg` })
      // todo return disconnect
    }

    switch (query.type) {
      case 'jpeg' :

        if (!stream.hasOwnProperty('pipe2jpeg')) {
          socket.binary(false).emit('message', { status: 'error', msg: `jpeg type not found for stream id ${query.id}` })
          // todo return disconnect
        }

        socket.on('request', (data) => {

          switch (data) {
            // send single jpeg
            case 'single' :
              socket.volatile.binary(true).emit('jpeg', stream.pipe2jpeg.jpeg)
              break

            // send endless jpegs
            case 'stream' :

              break

            // stop sending jpegs
            case 'stop' :

              break
          }
        })

        break
      case 'mp4' :
        if (!stream.hasOwnProperty('mp4frag')) {
          socket.binary(false).emit('message', { status: 'error', msg: `mp4 type not found for stream ${query.id}` })
          // todo return disconnect
        }
        break
    }

    socket.on('disconnect', (data) => {
      // console.log('socket disconnect');
    })

    socket.binary(false).emit('message', { status: 'ready', msg: `${query.type} type is available for stream id ${query.id}` })
  })
}
