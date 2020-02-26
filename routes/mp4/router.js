const router = require('express').Router()
const { playlist, setLocals, segment, video } = require('./mp4')

router.get('/playlist.m3u8', playlist)
router.get('/playlist.m3u8.txt', setLocals({ sendText: true }), playlist)
router.get('/init-[a-zA-Z]+.mp4', setLocals({ initOnly: true }), video)
router.get('/video.mp4', video)
router.get('/:segment(*.m4s)', segment)

module.exports = router
