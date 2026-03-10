const { request } = require('./http')

module.exports = {
  list(options = {}) {
    return request({ path: '/menu-categories', ...options })
  },

  upsert(payload, options = {}) {
    return request({ method: 'POST', path: '/menu-categories', data: payload, ...options })
  },

  reorder(keys = [], options = {}) {
    return request({ method: 'PATCH', path: '/menu-categories/reorder', data: { keys }, ...options })
  },

  remove(key, options = {}) {
    return request({ method: 'DELETE', path: `/menu-categories/${encodeURIComponent(String(key || ''))}`, ...options })
  }
}

