const WX_PROFILE_KEY = 'wx_identity_profile_v1'
const PAIR_CONTEXT_KEY = 'pair_context_v1'

function toHex(num) {
  return (`00000000${(num >>> 0).toString(16)}`).slice(-8)
}

function hash32(input) {
  const str = String(input || '')
  let hash = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function makeStableWxId(baseText) {
  const mixed = `${baseText}|rainbow-cats|wx`
  const h = hash32(mixed)
  return `wx_${toHex(h)}`
}

function makePairCodeByWxId(wxId) {
  const seed = `${wxId}|rainbow-cats|pair-code`
  const h = hash32(seed)
  return toHex(h).toUpperCase().slice(0, 8)
}

function makeUserIdByWxId(wxId) {
  const seed = `${wxId}|rainbow-cats|user-id`
  return `u_${toHex(hash32(seed))}`
}

function makePairSessionId(selfId, targetCode) {
  const sorted = [String(selfId || ''), String(targetCode || '').toUpperCase()].sort().join('|')
  return `pair_${toHex(hash32(`${sorted}|session`))}`
}

function toAuthWxId(authUser = {}) {
  return String(authUser.wxId || authUser.wxOpenId || '').trim()
}

function buildProfileFromAuthUser(authUser = {}) {
  const authWxId = toAuthWxId(authUser)
  if (!authWxId) return null
  return {
    wxId: authWxId,
    userId: String(authUser.id || makeUserIdByWxId(authWxId)),
    pairCode: makePairCodeByWxId(authWxId),
    nickName: String(authUser.nickName || authUser.username || '微信用户')
  }
}

function ensureWxIdentity(authUser = {}) {
  const fromAuth = buildProfileFromAuthUser(authUser)
  if (fromAuth) {
    try {
      wx.setStorageSync(WX_PROFILE_KEY, fromAuth)
    } catch (err) {
      // ignore storage write errors
    }
    return fromAuth
  }

  try {
    const exists = wx.getStorageSync(WX_PROFILE_KEY)
    if (exists && exists.wxId) return exists
  } catch (err) {
    // ignore storage read errors
  }

  let base = ''
  try {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    base = `${authUser.username || authUser.id || 'guest'}|${sys.model || ''}|${sys.platform || ''}|${sys.brand || ''}`
  } catch (err) {
    base = `${authUser.username || authUser.id || 'guest'}|device`
  }

  const wxId = makeStableWxId(base)
  const profile = {
    wxId,
    userId: makeUserIdByWxId(wxId),
    pairCode: makePairCodeByWxId(wxId),
    nickName: String(authUser.nickName || authUser.username || '微信用户')
  }
  try {
    wx.setStorageSync(WX_PROFILE_KEY, profile)
  } catch (err) {
    // ignore storage write errors
  }
  return profile
}

async function ensureWxIdentityAsync(authUser = {}) {
  return ensureWxIdentity(authUser)
}

function getWxIdentity() {
  try {
    return wx.getStorageSync(WX_PROFILE_KEY) || null
  } catch (err) {
    return null
  }
}

function getPairContext() {
  try {
    return wx.getStorageSync(PAIR_CONTEXT_KEY) || null
  } catch (err) {
    return null
  }
}

function setPairContext(context = {}) {
  try {
    wx.setStorageSync(PAIR_CONTEXT_KEY, context)
  } catch (err) {
    // ignore storage write errors
  }
}

function ensureDefaultPairContext(selfId) {
  const current = getPairContext()
  if (current && current.selfId) return current
  const context = {
    selfId,
    isPaired: false,
    pairSessionId: '',
    skipPairing: false
  }
  setPairContext(context)
  return context
}

function getActiveLinkId() {
  const context = getPairContext() || {}
  if (context.isPaired && context.pairSessionId) return context.pairSessionId
  return context.selfId || ''
}

module.exports = {
  ensureWxIdentity,
  ensureWxIdentityAsync,
  getWxIdentity,
  makePairCodeByWxId,
  makePairSessionId,
  getPairContext,
  setPairContext,
  ensureDefaultPairContext,
  getActiveLinkId
}
