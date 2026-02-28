const DEFAULT_API_BASE = 'http://127.0.0.1:3100/api'
let loadingCount = 0
let reloginPromise = null
let authExpiredHandler = null

function getApiBase() {
  try {
    const custom = wx.getStorageSync('apiBaseUrl')
    return (custom || DEFAULT_API_BASE).replace(/\/$/, '')
  } catch (err) {
    return DEFAULT_API_BASE
  }
}

function beginLoading(text = '加载中...') {
  if (loadingCount === 0) {
    wx.showLoading({ title: text, mask: true })
  }
  loadingCount += 1
}

function endLoading() {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    wx.hideLoading()
  }
}

function showErrorToast(message) {
  wx.showToast({
    title: message || '请求失败',
    icon: 'none'
  })
}

function getAuthToken() {
  try {
    return wx.getStorageSync('authToken') || ''
  } catch (err) {
    return ''
  }
}

function setAuthSession(token, user) {
  try {
    wx.setStorageSync('authToken', token || '')
    wx.setStorageSync('authUser', user || null)
  } catch (err) {
    // ignore storage exceptions
  }
}

function clearAuthSession() {
  try {
    wx.removeStorageSync('authToken')
    wx.removeStorageSync('authUser')
  } catch (err) {
    // ignore storage exceptions
  }
}

function getBootstrapAccount() {
  try {
    const custom = wx.getStorageSync('authBootstrapAccount')
    if (custom && typeof custom === 'object' && custom.username && custom.password) {
      return {
        username: String(custom.username),
        password: String(custom.password)
      }
    }
  } catch (err) {
    // ignore storage exceptions
  }
  return { username: 'me', password: '123456' }
}

function shouldAutoRelogin(path, err, retried) {
  if (retried) return false
  if (path === '/auth/login') return false
  const status = Number(err && err.statusCode)
  const bizCode = Number(err && err.bizCode)
  return status === 401 || bizCode === 10002 || bizCode === 11002 || bizCode === 11003
}

function doRequest({ method, path, data, token }) {
  const url = `${getApiBase()}${path}`
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 10000,
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }
        const err = new Error(body.message || `HTTP ${res.statusCode}`)
        err.statusCode = res.statusCode
        err.bizCode = body.code
        reject(err)
      },
      fail: (err) => {
        const e = new Error(err.errMsg || 'network error')
        e.statusCode = 0
        reject(e)
      }
    })
  })
}

function silentRelogin() {
  if (reloginPromise) return reloginPromise
  const url = `${getApiBase()}/auth/login`
  const account = getBootstrapAccount()
  reloginPromise = new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      data: { username: account.username, password: account.password },
      timeout: 10000,
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0 && body.data && body.data.token) {
          setAuthSession(body.data.token, body.data.user || null)
          resolve(body.data)
          return
        }
        clearAuthSession()
        reject(new Error((body && body.message) || `HTTP ${res.statusCode}`))
      },
      fail: () => {
        clearAuthSession()
        reject(new Error('relogin failed'))
      },
      complete: () => {
        reloginPromise = null
      }
    })
  })
  return reloginPromise
}

function notifyAuthExpired(payload) {
  if (typeof authExpiredHandler !== 'function') return
  try {
    authExpiredHandler(payload || {})
  } catch (err) {
    // ignore hook runtime errors
  }
}

function request({ method = 'GET', path, data, loading = true, loadingText = '加载中...', errorToast = true, allowAutoLogin = true }) {
  const run = (retried = false) => {
    const token = getAuthToken()
    return doRequest({ method, path, data, token }).catch(async (err) => {
      if (allowAutoLogin && shouldAutoRelogin(path, err, retried)) {
        try {
          await silentRelogin()
          return run(true)
        } catch (reloginErr) {
          notifyAuthExpired({
            reason: 'relogin_failed',
            path,
            statusCode: Number(err && err.statusCode) || 0,
            bizCode: Number(err && err.bizCode) || 0
          })
          throw err
        }
      }
      throw err
    })
  }

  if (loading) beginLoading(loadingText)

  return run(false)
    .then((dataRes) => {
      if (loading) endLoading()
      return dataRes
    })
    .catch((err) => {
      if (loading) endLoading()
      if (errorToast) {
        const statusCode = Number(err && err.statusCode)
        if (!statusCode) {
          showErrorToast('网络异常，请稍后再试')
        } else {
          showErrorToast(err.message)
        }
      }
      throw err
    })
}

function setAuthExpiredHandler(handler) {
  authExpiredHandler = typeof handler === 'function' ? handler : null
}

module.exports = { request, getApiBase, setAuthExpiredHandler }
