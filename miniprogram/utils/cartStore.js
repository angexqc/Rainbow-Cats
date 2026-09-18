const { getWxIdentity, getPairContext } = require('./identity')

const LEGACY_CART_KEY = 'cart'
const CART_PREFIX = 'cart_v2'
const CHECKOUT_PREFIX = 'order_checkout_v1'

function getScopeId() {
  const identity = getWxIdentity() || {}
  const context = getPairContext() || {}
  const userId = String(identity.userId || context.selfId || 'guest')
  const relationId = context.isPaired && context.pairSessionId
    ? String(context.pairSessionId)
    : 'single'
  return `${userId}:${relationId}`
}

function scopedKey(prefix) {
  return `${prefix}:${getScopeId()}`
}

function getCart() {
  const key = scopedKey(CART_PREFIX)
  const current = wx.getStorageSync(key)
  if (current && typeof current === 'object') return current
  const legacy = wx.getStorageSync(LEGACY_CART_KEY)
  if (legacy && typeof legacy === 'object' && Object.keys(legacy).length) {
    wx.setStorageSync(key, legacy)
    wx.removeStorageSync(LEGACY_CART_KEY)
    return legacy
  }
  return {}
}

function setCart(cart = {}) {
  wx.setStorageSync(scopedKey(CART_PREFIX), cart && typeof cart === 'object' ? cart : {})
}

function removeItems(menuIds = []) {
  const cart = { ...getCart() }
  menuIds.forEach((id) => { delete cart[id] })
  setCart(cart)
  return cart
}

function setCheckout(payload = {}) {
  wx.setStorageSync(scopedKey(CHECKOUT_PREFIX), payload)
}

function getCheckout() {
  return wx.getStorageSync(scopedKey(CHECKOUT_PREFIX)) || null
}

function clearCheckout() {
  wx.removeStorageSync(scopedKey(CHECKOUT_PREFIX))
}

module.exports = { getScopeId, getCart, setCart, removeItems, setCheckout, getCheckout, clearCheckout }
