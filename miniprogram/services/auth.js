const { request } = require('./http')

function getWxLoginCode() {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => resolve(String((res && res.code) || '')),
      fail: () => resolve('')
    })
  })
}

module.exports = {
  async login(options = {}) {
    const code = await getWxLoginCode()
    if (!code) {
      const err = new Error('微信登录失败，请重试')
      err.statusCode = 0
      throw err
    }
    return request({ method: 'POST', path: '/auth/login', data: { code }, allowAutoLogin: false, ...options })
  },

  loginWithBootstrapAccount(options = {}) {
    return this.login(options)
  },

  me(options = {}) {
    return request({ path: '/auth/me', ...options })
  },

  updateProfile(payload, options = {}) {
    return request({ method: 'PATCH', path: '/auth/profile', data: payload, ...options })
  }
}
