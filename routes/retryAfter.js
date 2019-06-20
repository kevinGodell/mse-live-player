const retryAfter = (res, text) =>
  res.status(503)
    .set('Retry-After', 10)
    .end(`Stream "${res.locals.id}" ${text} currently unavailable. Please try again later.`)

module.exports = retryAfter
