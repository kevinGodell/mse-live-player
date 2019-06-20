const { image, video } = require('./jpeg')
const router = require('express').Router()

router.get('image.jpeg', image)
router.get('video.mjpeg', video)

module.exports = router
