/**
 * 日志记录工具
 */

/**
 * 记录操作日志
 * @param {String} action 操作类型
 * @param {Object} data 数据
 */
function log(action, data) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${action}]`, JSON.stringify(data))
}

/**
 * 记录错误日志
 * @param {String} action 操作类型
 * @param {Error} err 错误对象
 * @param {Object} data 数据
 */
function error(action, err, data = {}) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] [ERROR] [${action}]`, err)
  console.error('[数据]', JSON.stringify(data))
}

module.exports = {
  log,
  error
}
