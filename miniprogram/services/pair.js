const { request } = require('./http')

module.exports = {
  getInfo(options = {}) {
    return request({ path: '/pair/info', ...options })
  },

  generateCode(wxId, options = {}) {
    return request({ method: 'POST', path: '/pair/code', data: { wxId }, ...options })
  },

  bind(code, options = {}) {
    return request({ method: 'POST', path: '/pair/bind', data: { code }, ...options })
  },

  unbind(options = {}) {
    return request({ method: 'POST', path: '/pair/unbind', ...options })
  }
}
