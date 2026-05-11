const DEFAULT_SHARE_TITLE = '小猫情侣点餐，今天一起吃点什么'
const DEFAULT_SHARE_PATH = '/pages/Home/index'

function normalizePath(path) {
  const raw = String(path || '').trim()
  if (!raw) return DEFAULT_SHARE_PATH
  return raw.startsWith('/') ? raw : `/${raw}`
}

function stringifyQuery(query = {}) {
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && String(query[key]).trim() !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
    .join('&')
}

function buildSharePath(path, query) {
  const normalizedPath = normalizePath(path)
  const queryString = stringifyQuery(query)
  return queryString ? `${normalizedPath}?${queryString}` : normalizedPath
}

function buildSharePayload(options = {}) {
  const title = String(options.title || '').trim() || DEFAULT_SHARE_TITLE
  const path = buildSharePath(options.path || DEFAULT_SHARE_PATH, options.query)
  const payload = {
    title,
    path
  }
  const imageUrl = String(options.imageUrl || '').trim()
  if (imageUrl) payload.imageUrl = imageUrl
  return payload
}

function buildTimelinePayload(options = {}) {
  const title = String(options.title || '').trim() || DEFAULT_SHARE_TITLE
  const payload = {
    title,
    query: stringifyQuery(options.query)
  }
  const imageUrl = String(options.imageUrl || '').trim()
  if (imageUrl) payload.imageUrl = imageUrl
  return payload
}

module.exports = {
  DEFAULT_SHARE_TITLE,
  DEFAULT_SHARE_PATH,
  buildSharePayload,
  buildTimelinePayload
}
