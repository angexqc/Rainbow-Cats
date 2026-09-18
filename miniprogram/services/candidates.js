const { request } = require('./http')

module.exports = {
  list(options = {}) {
    return request({ path: '/candidates', ...options })
  },
  add(menuId, options = {}) {
    return request({ method: 'POST', path: '/candidates', data: { menuId }, ...options })
  },
  remove(id, options = {}) {
    return request({ method: 'DELETE', path: `/candidates/${id}`, ...options })
  },
  vote(id, choice, options = {}) {
    return request({ method: 'POST', path: `/candidates/${id}/vote`, data: { choice }, ...options })
  }
}
