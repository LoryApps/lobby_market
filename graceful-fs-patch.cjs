// Preloaded via NODE_OPTIONS in the build script.
// Patches Node's fs module so EMFILE on readdir/opendir queues and retries
// instead of crashing — necessary in CI where the hard fd limit is 4096 and
// Next.js's glob scanner opens hundreds of directories simultaneously.
const gfs = require('graceful-fs')
const fs = require('fs')
gfs.gracefulify(fs)

// graceful-fs < v5 doesn't patch fs.opendir; add retry shim manually.
if (fs.opendir && !fs.opendir._graceful) {
  const orig = fs.opendir.bind(fs)
  fs.opendir = function gracefulOpendir(path, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    function attempt() {
      orig(path, opts, function(err, dir) {
        if (err && err.code === 'EMFILE') {
          setTimeout(attempt, 100)
        } else if (cb) {
          cb(err, dir)
        }
      })
    }
    attempt()
  }
  fs.opendir._graceful = true
}
