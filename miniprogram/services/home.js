const { request } = require('./http')

module.exports = {
  getBanners(options = {}) {
    return request({ path: '/home/banners', ...options })
  },

  getRanking(period = 'week', limit = 5, options = {}) {
    return request({ path: '/home/ranking', data: { period, limit }, ...options })
  },

  getPopular(options = {}) {
    return request({ path: '/home/popular', ...options })
  }
}
