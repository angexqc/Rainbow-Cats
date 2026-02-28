const { request } = require('./http')

module.exports = {
  list(params, options = {}) {
    return request({ path: '/menus', data: params, ...options })
  },

  detail(id, options = {}) {
    return request({ path: `/menus/${id}`, ...options })
  },

  create(payload, options = {}) {
    return request({ method: 'POST', path: '/menus', data: payload, ...options })
  },

  update(id, payload, options = {}) {
    return request({ method: 'PATCH', path: `/menus/${id}`, data: payload, ...options })
  },

  remove(id, options = {}) {
    return request({ method: 'DELETE', path: `/menus/${id}`, ...options })
  }
}
