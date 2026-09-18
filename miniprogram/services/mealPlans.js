const { request } = require('./http')
module.exports = {
  list(options = {}) { return request({ path: '/meal-plans', ...options }) },
  create(payload, options = {}) { return request({ method: 'POST', path: '/meal-plans', data: payload, ...options }) },
  update(id, payload, options = {}) { return request({ method: 'PATCH', path: `/meal-plans/${id}`, data: payload, ...options }) },
  remove(id, options = {}) { return request({ method: 'DELETE', path: `/meal-plans/${id}`, ...options }) }
}
