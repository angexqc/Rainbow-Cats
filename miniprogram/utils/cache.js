/**
 * 数据缓存工具
 */

const DEFAULT_EXPIRE_SECONDS = 600 // 默认10分钟

/**
 * 设置缓存
 * @param {String} key 缓存键
 * @param {*} data 数据
 * @param {Number} expireSeconds 过期时间（秒），默认600秒（10分钟）
 */
function set(key, data, expireSeconds = DEFAULT_EXPIRE_SECONDS) {
  try {
    const expireTime = Date.now() + expireSeconds * 1000
    wx.setStorageSync(key, { data, expireTime })
    return true
  } catch (err) {
    console.error(`[cache] set error for key "${key}":`, err)
    return false
  }
}

/**
 * 获取缓存
 * @param {String} key 缓存键
 */
function get(key) {
  try {
    const cached = wx.getStorageSync(key)
    if (!cached) return null

    // 检查是否过期
    if (Date.now() > cached.expireTime) {
      // 已过期，删除缓存
      wx.removeStorageSync(key)
      return null
    }

    return cached.data
  } catch (err) {
    console.error(`[cache] get error for key "${key}":`, err)
    return null
  }
}

/**
 * 删除缓存
 * @param {String} key 缓存键
 */
function remove(key) {
  try {
    wx.removeStorageSync(key)
    return true
  } catch (err) {
    console.error(`[cache] remove error for key "${key}":`, err)
    return false
  }
}

/**
 * 清空所有缓存
 */
function clear() {
  try {
    wx.clearStorageSync()
    return true
  } catch (err) {
    console.error('[cache] clear error:', err)
    return false
  }
}

module.exports = {
  set,
  get,
  remove,
  clear
}
