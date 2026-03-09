const { getApiBase } = require('./http')

let socketTask = null
let reconnectTimer = null
let shouldReconnect = false
let isConnecting = false
let messageHandler = null

function getWsUrl() {
  const base = String(getApiBase() || '').trim().replace(/\/+$/, '')
  const wsBase = base.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://')
  const token = String(wx.getStorageSync('authToken') || '').trim()
  if (!wsBase || !token) return ''
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (!shouldReconnect) return
  clearReconnectTimer()
  reconnectTimer = setTimeout(() => {
    connect()
  }, 1500)
}

function handleMessage(msg = {}) {
  if (typeof messageHandler === 'function') {
    try {
      messageHandler(msg)
    } catch (err) {
      // ignore handler runtime errors
    }
  }
}

function connect() {
  if (isConnecting || socketTask) return
  const url = getWsUrl()
  if (!url) {
    scheduleReconnect()
    return
  }
  isConnecting = true
  try {
    const task = wx.connectSocket({ url })
    socketTask = task
    task.onOpen(() => {
      isConnecting = false
      clearReconnectTimer()
    })
    task.onMessage((res) => {
      let payload = {}
      try {
        payload = JSON.parse(String((res && res.data) || '{}'))
      } catch (err) {
        payload = {}
      }
      handleMessage(payload)
    })
    task.onClose(() => {
      isConnecting = false
      socketTask = null
      scheduleReconnect()
    })
    task.onError(() => {
      isConnecting = false
      socketTask = null
      scheduleReconnect()
    })
  } catch (err) {
    isConnecting = false
    socketTask = null
    scheduleReconnect()
  }
}

function start(handler) {
  messageHandler = typeof handler === 'function' ? handler : null
  shouldReconnect = true
  connect()
}

function stop() {
  shouldReconnect = false
  clearReconnectTimer()
  if (socketTask) {
    try {
      socketTask.close()
    } catch (err) {
      // ignore close errors
    }
  }
  socketTask = null
  isConnecting = false
}

module.exports = {
  start,
  stop
}
