const { request } = require('./http')

module.exports = {
  get(options = {}) { return request({ path: '/preferences', ...options }) },
  getPartner(options = {}) { return request({ path: '/preferences/partner', ...options }) },
  update(payload, options = {}) { return request({ method: 'PATCH', path: '/preferences', data: payload, ...options }) }
}
