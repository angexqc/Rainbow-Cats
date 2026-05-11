const { createDefaultMockDB } = require('./mockData')

const DB_STORAGE_KEY = 'RAINBOW_CATS_MOCK_DB_V1'
const SCHEMA_VERSION = 4

function clone(data) {
  return JSON.parse(JSON.stringify(data))
}

function normalizeMenus(menus = []) {
  return menus.map((m) => ({
    _id: m._id,
    title: m.title,
    image: m.image,
    desc: m.desc || '',
    category: m.category || 'other',
    categoryLabel: m.categoryLabel || m.category || 'other',
    available: m.available !== false,
    owner: m.owner || 'me'
  }))
}

function normalizeOrders(orders = []) {
  return orders.map((order) => {
    const items = (order.items || []).map((item) => ({
      menuId: item.menuId,
      title: item.title,
      image: item.image,
      desc: item.desc || '',
      count: Number(item.count || 0)
    }))

    const totalCount = Number(order.totalCount || items.reduce((sum, it) => sum + it.count, 0))
    return {
      ...order,
      items,
      totalCount,
      timeline: Array.isArray(order.timeline) ? order.timeline : [],
      liked: !!order.liked,
      review: order.review || ''
    }
  })
}

function readDB() {
  try {
    const data = wx.getStorageSync(DB_STORAGE_KEY)
    if (data && data.version >= SCHEMA_VERSION) return data
    if (data && data.version) {
      const seed = createDefaultMockDB()
      const migrated = {
        ...seed,
        ...data,
        version: SCHEMA_VERSION,
        banners: Array.isArray(data.banners) && data.banners.length ? data.banners : seed.banners,
        pair: {
          ...seed.pair,
          ...(data.pair || {}),
          myInfo: (data.pair && data.pair.myInfo) ? data.pair.myInfo : seed.pair.myInfo,
          partnerInfo: {
            ...seed.pair.partnerInfo,
            ...((data.pair && data.pair.partnerInfo) || {})
          }
        },
        menus: normalizeMenus(Array.isArray(data.menus) ? data.menus : seed.menus),
        orders: normalizeOrders(Array.isArray(data.orders) ? data.orders : seed.orders)
      }
      writeDB(migrated)
      return migrated
    }
  } catch (err) {
    console.error('read mock db error:', err)
  }
  const seed = createDefaultMockDB()
  writeDB(seed)
  return seed
}

function writeDB(db) {
  wx.setStorageSync(DB_STORAGE_KEY, db)
}

function ensureMockDB() {
  return clone(readDB())
}

function updateDB(mutator) {
  const db = readDB()
  mutator(db)
  writeDB(db)
  return clone(db)
}

function formatDate(dateInput) {
  const d = new Date(dateInput)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function getRoleName(db, role) {
  if (!db || !db.pair) return role === 'me' ? '我' : 'TA'
  if (role === 'me') return (db.pair.myInfo && db.pair.myInfo.nickName) ? db.pair.myInfo.nickName : '我'
  if (role === 'ta') return (db.pair.partnerInfo && db.pair.partnerInfo.nickName) ? db.pair.partnerInfo.nickName : 'TA'
  return '系统'
}

function getOppositeRole(role) {
  return role === 'ta' ? 'me' : 'ta'
}

function buildTimeline(order, db) {
  if (Array.isArray(order.timeline) && order.timeline.length) {
    return order.timeline
  }

  const timeline = [{
    status: 'pending',
    label: '已下单',
    time: order.date,
    actorRole: order.creatorRole || 'me',
    actorName: getRoleName(db, order.creatorRole || 'me')
  }]

  if (order.confirmTime) {
    const confirmRole = getOppositeRole(order.creatorRole || 'me')
    timeline.push({
      status: 'confirmed',
      label: '已确认',
      time: order.confirmTime,
      actorRole: confirmRole,
      actorName: getRoleName(db, confirmRole)
    })
  }

  if (order.completeTime) {
    const completeRole = getOppositeRole(order.creatorRole || 'me')
    timeline.push({
      status: 'completed',
      label: '已完成',
      time: order.completeTime,
      actorRole: completeRole,
      actorName: getRoleName(db, completeRole)
    })
  }

  if (order.status === 'cancelled') {
    timeline.push({
      status: 'cancelled',
      label: '已取消',
      time: order.completeTime || order.confirmTime || Date.now(),
      actorRole: order.creatorRole || 'me',
      actorName: getRoleName(db, order.creatorRole || 'me')
    })
  }

  return timeline
}

function makePairCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase()
}

function getHomeBanners() {
  return clone(readDB().banners || [])
}

function deleteHomeBanner(url) {
  let removed = false
  updateDB((db) => {
    const prev = Array.isArray(db.banners) ? db.banners : []
    const next = prev.filter((item) => {
      if (!removed && item === url) {
        removed = true
        return false
      }
      return true
    })
    db.banners = next
  })
  return removed
}

function getPairInfo() {
  const db = readDB()
  return clone(db.pair)
}

function generatePairCode() {
  const code = makePairCode()
  updateDB((db) => {
    db.pair.pairCode = code
  })
  return code
}

function bindPair(inputCode) {
  // TODO: 接入后端时，校验 inputCode 与真实配对码并处理过期逻辑。
  return updateDB((db) => {
    db.pair.isPaired = true
    db.pair.partnerInfo.bindTime = formatDate(Date.now())
    db.pair.lastBindCode = inputCode
  }).pair
}

function unbindPair() {
  return updateDB((db) => {
    db.pair.isPaired = false
    db.pair.partnerInfo.bindTime = ''
  }).pair
}

function getMenuList({ category = '', keyword = '', available, page = 1, pageSize = 20 }) {
  const db = readDB()
  let list = db.menus.slice()

  if (category) list = list.filter((it) => it.category === category)
  if (typeof available === 'boolean') list = list.filter((it) => it.available === available)
  if (keyword) {
    const q = String(keyword).trim().toLowerCase()
    list = list.filter((it) => it.title.toLowerCase().includes(q) || (it.desc || '').toLowerCase().includes(q))
  }

  const start = (Number(page) - 1) * Number(pageSize)
  const end = start + Number(pageSize)
  return {
    list: clone(list.slice(start, end)),
    hasMore: end < list.length,
    total: list.length
  }
}

function getMenuById(id) {
  const db = readDB()
  return clone(db.menus.find((it) => it._id === id) || null)
}

function addMenu(payload) {
  // TODO: 接入真实上传时，image 应保存为 CDN 地址并做内容审核。
  return updateDB((db) => {
    db.nextMenuSeq += 1
    db.menus.unshift({
      _id: `m_${db.nextMenuSeq}`,
      title: payload.title,
      image: payload.image,
      desc: payload.desc,
      category: payload.category,
      categoryLabel: payload.categoryLabel || payload.category || 'other',
      available: payload.available !== false,
      owner: payload.owner || 'me'
    })
  }).menus[0]
}

function updateMenu(id, payload) {
  let updated = null
  updateDB((db) => {
    const idx = db.menus.findIndex((it) => it._id === id)
    if (idx < 0) return
    db.menus[idx] = {
      ...db.menus[idx],
      ...payload
    }
    updated = db.menus[idx]
  })
  return clone(updated)
}

function deleteMenu(id) {
  updateDB((db) => {
    db.menus = db.menus.filter((it) => it._id !== id)
  })
}

function toggleMenuStatus(id, available) {
  return updateMenu(id, { available })
}

function createOrder({ items, remark, creatorUserId, creatorRole, creatorName, creatorAvatar, orderNo, createdAt }) {
  // TODO: 接入后端时补充接单状态机、超时自动取消、并发库存校验。
  return updateDB((db) => {
    db.nextOrderSeq += 1
    const now = Number(createdAt || Date.now())
    const nextCreatorUserId = String(creatorUserId || '').trim()
    const nextCreatorRole = String(creatorRole || '').trim() === 'ta' ? 'ta' : 'me'
    const nextCreatorName = String(creatorName || '').trim()
    const nextCreatorAvatar = String(creatorAvatar || '').trim()
    const nextOrderNo = String(orderNo || '').trim() || `RC${now}${String(db.nextOrderSeq).padStart(4, '0')}`
    const normalized = items.map((it) => ({
      menuId: it.menuId,
      title: it.title,
      image: it.image,
      desc: it.desc,
      count: Number(it.count)
    }))
    const totalCount = normalized.reduce((sum, it) => sum + it.count, 0)

    db.orders.unshift({
      _id: `o_${db.nextOrderSeq}`,
      orderNo: nextOrderNo,
      status: 'pending',
      creatorRole: nextCreatorRole,
      creatorUserId: nextCreatorUserId,
      creatorName: nextCreatorName,
      creatorAvatar: nextCreatorAvatar,
      date: now,
      confirmTime: null,
      completeTime: null,
      items: normalized,
      totalCount,
      remark: remark || '',
      liked: false,
      review: '',
      timeline: [{
        status: 'pending',
        label: '已下单',
        time: now,
        actorRole: nextCreatorRole,
        actorUserId: nextCreatorUserId,
        actorName: nextCreatorName || getRoleName(db, nextCreatorRole),
        actorAvatar: nextCreatorAvatar
      }]
    })
  }).orders[0]
}

function getOrderList({ status = '', page = 1, pageSize = 15 }) {
  const db = readDB()
  let list = db.orders.slice().map((order) => ({
    ...order,
    timeline: buildTimeline(order, db)
  }))
  if (status) list = list.filter((it) => it.status === status)

  const start = (Number(page) - 1) * Number(pageSize)
  const end = start + Number(pageSize)
  return {
    list: clone(list.slice(start, end)),
    hasMore: end < list.length,
    total: list.length
  }
}

function getOrderById(id) {
  const db = readDB()
  const order = db.orders.find((it) => it._id === id)
  if (!order) return null
  return clone({
    ...order,
    timeline: buildTimeline(order, db)
  })
}

function updateOrderStatus(id, action) {
  let result = null
  updateDB((db) => {
    const order = db.orders.find((it) => it._id === id)
    if (!order) return
    if (!Array.isArray(order.timeline) || !order.timeline.length) {
      order.timeline = buildTimeline(order, db)
    }

    if (action === 'cancel' && ['pending', 'confirmed'].includes(order.status)) {
      const cancelRole = order.creatorRole || 'me'
      order.status = 'cancelled'
      order.timeline.push({
        status: 'cancelled',
        label: '已取消',
        time: Date.now(),
        actorRole: cancelRole,
        actorName: getRoleName(db, cancelRole)
      })
    }
    if (action === 'confirm' && order.status === 'pending') {
      const confirmRole = getOppositeRole(order.creatorRole || 'me')
      order.status = 'confirmed'
      order.confirmTime = Date.now()
      order.timeline.push({
        status: 'confirmed',
        label: '已确认',
        time: order.confirmTime,
        actorRole: confirmRole,
        actorName: getRoleName(db, confirmRole)
      })
    }
    if (action === 'complete' && order.status === 'confirmed') {
      const completeRole = getOppositeRole(order.creatorRole || 'me')
      order.status = 'completed'
      order.completeTime = Date.now()
      order.timeline.push({
        status: 'completed',
        label: '已完成',
        time: order.completeTime,
        actorRole: completeRole,
        actorName: getRoleName(db, completeRole)
      })
    }

    result = order
  })
  return clone(result)
}

function setOrderFeedback(id, payload) {
  let result = null
  updateDB((db) => {
    const order = db.orders.find((it) => it._id === id)
    if (!order) return
    if (typeof payload.liked === 'boolean') {
      order.liked = payload.liked
    }
    if (typeof payload.review === 'string') {
      order.review = payload.review.trim()
    }
    result = order
  })
  return clone(result)
}

function getPeriodStart(period) {
  const nowDate = new Date()
  if (period === 'week') {
    // Natural week: from Monday 00:00 of current week (not rolling last 7 days)
    const start = new Date(nowDate)
    const weekday = start.getDay() // 0=Sun,1=Mon...
    const diffToMonday = (weekday + 6) % 7
    start.setDate(start.getDate() - diffToMonday)
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }
  if (period === 'month') {
    const start = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }
  if (period === 'year') {
    const start = new Date(nowDate.getFullYear(), 0, 1)
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }
  return 0
}

function rankFromOrders(orders, menus, limit = 5) {
  const menuMap = {}
  menus.forEach((m) => { menuMap[m._id] = m })

  const counter = {}
  orders.forEach((order) => {
    ;(order.items || []).forEach((item) => {
      if (!counter[item.menuId]) {
        const ref = menuMap[item.menuId] || {}
        counter[item.menuId] = {
          menuId: item.menuId,
          title: item.title || ref.title || '未知菜品',
          image: item.image || ref.image || '',
          category: ref.category || '',
          count: 0
        }
      }
      counter[item.menuId].count += Number(item.count || 0)
    })
  })

  return Object.values(counter)
    .sort((a, b) => (b.count - a.count))
    .slice(0, limit)
}

function getDishRanking(period = 'week', limit = 5) {
  // TODO: 接入后端后改为服务端统计接口，减少前端聚合开销。
  const db = readDB()
  const start = getPeriodStart(period)
  const orders = db.orders.filter((o) => o.date >= start)
  return clone(rankFromOrders(orders, db.menus, limit))
}

function getMostPopularDish() {
  const db = readDB()
  const top = rankFromOrders(db.orders, db.menus, 1)[0]
  if (top) return clone(top)
  if (db.menus.length) {
    const first = db.menus[0]
    return {
      menuId: first._id,
      title: first.title,
      image: first.image,
      category: first.category,
      count: 0
    }
  }
  return null
}

module.exports = {
  ensureMockDB,
  formatDate,
  getHomeBanners,
  deleteHomeBanner,
  getPairInfo,
  generatePairCode,
  bindPair,
  unbindPair,
  getMenuList,
  getMenuById,
  addMenu,
  updateMenu,
  deleteMenu,
  toggleMenuStatus,
  createOrder,
  getOrderList,
  getOrderById,
  updateOrderStatus,
  setOrderFeedback,
  getDishRanking,
  getMostPopularDish
}
