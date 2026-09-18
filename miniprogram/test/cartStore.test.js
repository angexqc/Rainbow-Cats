const test = require('node:test')
const assert = require('node:assert/strict')

function createWxStorage() {
  const storage = new Map()
  global.wx = {
    getStorageSync(key) { return storage.get(key) },
    setStorageSync(key, value) { storage.set(key, value) },
    removeStorageSync(key) { storage.delete(key) },
    getSystemInfoSync() { return {} }
  }
  return storage
}

function loadCartStore() {
  delete require.cache[require.resolve('../utils/identity')]
  delete require.cache[require.resolve('../utils/cartStore')]
  return require('../utils/cartStore')
}

test('购物车按用户和配对会话隔离', () => {
  const storage = createWxStorage()
  storage.set('wx_identity_profile_v1', { userId: 'u_a', wxId: 'wx_a' })
  storage.set('pair_context_v1', { selfId: 'u_a', isPaired: false, pairSessionId: '' })
  const cartStore = loadCartStore()
  cartStore.setCart({ m_1: { count: 1 } })

  storage.set('pair_context_v1', { selfId: 'u_a', isPaired: true, pairSessionId: 'pair_ab' })
  assert.deepEqual(cartStore.getCart(), {})
  cartStore.setCart({ m_2: { count: 2 } })

  storage.set('wx_identity_profile_v1', { userId: 'u_b', wxId: 'wx_b' })
  storage.set('pair_context_v1', { selfId: 'u_b', isPaired: true, pairSessionId: 'pair_ab' })
  assert.deepEqual(cartStore.getCart(), {})

  storage.set('wx_identity_profile_v1', { userId: 'u_a', wxId: 'wx_a' })
  assert.deepEqual(cartStore.getCart(), { m_2: { count: 2 } })
})

test('旧 cart 只迁移到当前作用域一次', () => {
  const storage = createWxStorage()
  storage.set('wx_identity_profile_v1', { userId: 'u_a', wxId: 'wx_a' })
  storage.set('pair_context_v1', { selfId: 'u_a', isPaired: false, pairSessionId: '' })
  storage.set('cart', { legacy: { count: 1 } })
  const cartStore = loadCartStore()
  assert.deepEqual(cartStore.getCart(), { legacy: { count: 1 } })
  assert.equal(storage.has('cart'), false)
  storage.set('wx_identity_profile_v1', { userId: 'u_b', wxId: 'wx_b' })
  storage.set('pair_context_v1', { selfId: 'u_b', isPaired: false, pairSessionId: '' })
  assert.deepEqual(cartStore.getCart(), {})
})
