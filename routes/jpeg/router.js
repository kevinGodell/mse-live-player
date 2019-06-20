const { image, video } = require('./jpeg')
const router = require('express').Router()

router.get('image.jpeg', image)
router.get('/api/*/jpeg/video.mjpeg', video)

module.exports = router
