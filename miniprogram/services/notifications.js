const { request } = require('./http')

module.exports = {
  getSettings(options = {}) {
    return request({ path: '/notifications/settings', ...options })
  },

  getTemplates(options = {}) {
    return request({ path: '/notifications/templates', ...options })
  },

  updateSettings(payload, options = {}) {
    return request({ method: 'POST', path: '/notifications/settings', data: payload, ...options })
  },

  bindWxSession(code, options = {}) {
    return request({ method: 'POST', path: '/notifications/wx-session', data: { code }, ...options })
  },

  sendTest(options = {}) {
    return request({ method: 'POST', path: '/notifications/test', ...options })
  }
}
