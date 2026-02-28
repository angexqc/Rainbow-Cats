/**
 * 统一错误处理工具
 */

/**
 * 处理云函数错误
 * @param {Error} err 错误对象
 * @param {String} operation 操作描述
 * @param {Object} context 上下文信息
 */
function handleCloudError(err, operation, context = {}) {
  console.error(`[云函数错误] ${operation}:`, err)
  console.error('[上下文]', context)

  // 根据错误类型返回友好提示
  if (err.errCode === -1) {
    return { success: false, message: '网络异常，请稍后重试' }
  }
  if (err.errCode === -502001) {
    return { success: false, message: '云函数执行失败' }
  }
  if (err.errMsg) {
    // 提取有意义的错误信息
    const msg = err.errMsg.replace(/Error:/gi, '').trim()
    return { success: false, message: msg || '操作失败' }
  }
  return { success: false, message: '操作失败' }
}

/**
 * 显示错误提示
 * @param {String} message 错误信息
 */
function showToast(message) {
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  })
}

module.exports = {
  handleCloudError,
  showToast
}
