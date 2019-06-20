const express = require('express')
const id = require('./params/id')
const type = require('./params/type')

module.exports = (app) => {
  app.disable('x-powered-by')

  app.all('/*', (req, res, next) => {
    // todo verify authenticated and reroute if necessary
    // console.log('req.url', req.url)
    next()
  })

  app.use(express.static('www'))

  app.param('id', id)
  app.param('type', type)

  app.get('/api/:id/:type/*', (req, res, next) => {
    // trigger the app.param functions
    // console.log('trigger the param parser', req.params.id, req.params.type)
    next()
  })

  app.use('/api/*/jpeg', require('./jpeg/router'))
  app.use('/api/*/mp4', require('./mp4/router'))

  app.get('/api/*/cmd/:action', (req, res) => {
    const { action } = req.params
    const { ffmpeg } = res.locals

    if (action === 'start' && !ffmpeg.running) {
      ffmpeg.start()
    }

    if (action === 'stop' && ffmpeg.running) {
      ffmpeg.stop()
    }

    res.status(200).end(`ffmpeg running: ${ffmpeg.running}`)
  })
}

// todo listen to video player stop and alert all connected streams
