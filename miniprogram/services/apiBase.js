const PROD_API_BASE_URL = 'https://wubaihappyfood.top/api'
const LOCAL_API_BASE_URL = 'http://127.0.0.1:3100/api'

function isLocalHttpApiBase(url) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(String(url || '').trim())
}

function normalizeApiBase(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '')
  if (!raw) return ''
  if (/^http:\/\//i.test(raw) && !isLocalHttpApiBase(raw)) {
    return raw.replace(/^http:\/\//i, 'https://')
  }
  return raw
}

function getEnvVersion(wxApi) {
  try {
    const account = wxApi && typeof wxApi.getAccountInfoSync === 'function'
      ? wxApi.getAccountInfoSync()
      : null
    return String(account && account.miniProgram && account.miniProgram.envVersion || '')
  } catch (err) {
    return ''
  }
}

function selectApiBase(storedUrl, wxApi) {
  const normalized = normalizeApiBase(storedUrl)
  const isDevelop = getEnvVersion(wxApi) === 'develop'
  if (isDevelop && (!normalized || normalized === PROD_API_BASE_URL)) {
    return LOCAL_API_BASE_URL
  }
  return normalized || PROD_API_BASE_URL
}

function isAllowedUploadApiBase(url) {
  const raw = String(url || '').trim()
  return /^https:\/\//i.test(raw) || isLocalHttpApiBase(raw)
}

module.exports = {
  PROD_API_BASE_URL,
  LOCAL_API_BASE_URL,
  normalizeApiBase,
  selectApiBase,
  isAllowedUploadApiBase
}
