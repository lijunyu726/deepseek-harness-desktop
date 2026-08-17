/** Terminate the desktop server when the Electron owner no longer exists. */

const ownerPid = Number(process.env.DSH_DESKTOP_PARENT_PID)

if (Number.isInteger(ownerPid) && ownerPid > 1) {
  const timer = setInterval(() => {
    let ownerAlive = process.ppid === ownerPid
    if (ownerAlive) {
      try {
        process.kill(ownerPid, 0)
      } catch (error) {
        ownerAlive = error?.code !== 'ESRCH'
      }
    }
    if (ownerAlive) return
    clearInterval(timer)
    process.kill(process.pid, 'SIGTERM')
  }, 2000)
  timer.unref()
}
