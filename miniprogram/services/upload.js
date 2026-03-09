const { getApiBase } = require('./http')

function getWxLoginCode() {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => resolve(String((res && res.code) || '')),
      fail: () => resolve('')
    })
  })
}

function getApiOrigin() {
  const base = String(getApiBase() || '').replace(/\/+$/, '')
  return base.endsWith('/api') ? base.slice(0, -4) : base
}

function normalizeUploadedUrl(inputUrl) {
  const raw = String(inputUrl || '').trim()
  if (!raw) return ''
  const origin = getApiOrigin()
  if (!origin) return raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      const path = `${u.pathname || ''}${u.search || ''}${u.hash || ''}`
      return `${origin}${path}`
    } catch (err) {
      return raw
    }
  }
  if (raw.startsWith('/')) return `${origin}${raw}`
  return `${origin}/${raw}`
}

function ensureAuthToken(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const token = wx.getStorageSync('authToken') || ''
      if (token) return Promise.resolve(token)
    } catch (err) {
      // ignore storage exceptions
    }
  }

  return getWxLoginCode().then((code) => new Promise((resolve, reject) => {
    if (!code) {
      reject(new Error('wx login failed'))
      return
    }
    wx.request({
      url: `${getApiBase()}/auth/login`,
      method: 'POST',
      data: { code },
      timeout: 10000,
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0 && body.data && body.data.token) {
          try {
            wx.setStorageSync('authToken', body.data.token)
            wx.setStorageSync('authUser', body.data.user || null)
          } catch (err) {
            // ignore storage exceptions
          }
          resolve(body.data.token)
          return
        }
        reject(new Error((body && body.message) || `HTTP ${res.statusCode}`))
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || 'relogin failed'))
      }
    })
  }))
}

function uploadImage(filePath, folder = 'menus') {
  const base = String(getApiBase() || '').trim()
  if (!/^https:\/\//i.test(base)) {
    return Promise.reject(new Error('上传地址必须是 HTTPS，请检查 apiBaseUrl 配置'))
  }
  const url = `${base}/upload/image?folder=${encodeURIComponent(folder)}`
  const doUpload = (token, retry = true) =>
    new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: async (res) => {
          let body = {}
          try {
            body = JSON.parse(res.data || '{}')
          } catch (err) {
            body = {}
          }
          if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0 && body.data && body.data.url) {
            resolve(normalizeUploadedUrl(body.data.url))
            return
          }

          const unauthorized = Number(res.statusCode) === 401 || Number(body.code) === 10002 || Number(body.code) === 11002 || Number(body.code) === 11003
          if (retry && unauthorized) {
            try {
              const refreshed = await ensureAuthToken(true)
              resolve(doUpload(refreshed, false))
              return
            } catch (err) {
              // fallback to reject with origin response
            }
          }

          const e = new Error(body.message || `HTTP ${res.statusCode}`)
          e.statusCode = res.statusCode
          e.bizCode = body.code
          reject(e)
        },
        fail: (err) => {
          const e = new Error((err && err.errMsg) || 'upload failed')
          e.statusCode = 0
          reject(e)
        }
      })
    })

  return ensureAuthToken().then((token) => doUpload(token, true))
}

module.exports = { uploadImage }
