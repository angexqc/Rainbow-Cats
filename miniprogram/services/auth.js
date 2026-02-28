const { request } = require('./http')

const DEFAULT_ACCOUNT = { username: 'me', password: '123456' }

function getBootstrapAccount() {
  try {
    const custom = wx.getStorageSync('authBootstrapAccount')
    if (custom && typeof custom === 'object' && custom.username && custom.password) {
      return {
        username: String(custom.username),
        password: String(custom.password)
      }
    }
  } catch (err) {
    // ignore storage exceptions
  }
  return DEFAULT_ACCOUNT
}

module.exports = {
  login(username, password, options = {}) {
    return request({ method: 'POST', path: '/auth/login', data: { username, password }, ...options })
  },

  loginWithBootstrapAccount(options = {}) {
    const account = getBootstrapAccount()
    return this.login(account.username, account.password, options)
  },

  getBootstrapAccount,

  me(options = {}) {
    return request({ path: '/auth/me', ...options })
  }
}
