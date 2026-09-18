const { request } = require('./http')

function resource(kind) { return kind === 'favorite' ? '/favorites' : '/wish-list' }

module.exports = {
  list(kind, options = {}) { return request({ path: resource(kind), ...options }) },
  add(kind, menuId, options = {}) { return request({ method: 'POST', path: resource(kind), data: { menuId }, ...options }) },
  remove(kind, menuId, options = {}) { return request({ method: 'DELETE', path: `${resource(kind)}/${menuId}`, ...options }) }
}
