const { request } = require('./http')

module.exports = {
  list(params, options = {}) {
    return request({ path: '/orders', data: params, ...options })
  },

  detail(id, options = {}) {
    return request({ path: `/orders/${id}`, ...options })
  },

  create(payload, options = {}) {
    return request({ method: 'POST', path: '/orders', data: payload, ...options })
  },

  updateStatus(id, action, options = {}) {
    return request({ method: 'POST', path: `/orders/${id}/status`, data: { action }, ...options })
  },

  feedback(id, payload, options = {}) {
    return request({ method: 'POST', path: `/orders/${id}/feedback`, data: payload, ...options })
  }
}
