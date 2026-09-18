const app = getApp()
const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function monthText(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function itemText(items = []) {
  if (!Array.isArray(items) || !items.length) return ''
  return items.map((it) => `${it.title} x${it.count}`).join('，')
}

Page({
  data: {
    topSafeHeight: 0,
    loading: true,
    currentMonth: '',
    weekLabels: ['一', '二', '三', '四', '五', '六', '日'],
    calendarDays: [],
    selectedDateKey: '',
    selectedOrders: [],
    dateCountMap: {},
    statusMap: app.globalData ? app.globalData.orderStatusMap : {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消'
    }
  },

  onLoad() {
    const now = new Date()
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
    this.currentMonthDate = now
    this.allOrders = []
    this.setData({
      topSafeHeight: getTopSafeHeight(),
      currentMonth: monthText(now)
    })
    this.initData()
  },

  async initData() {
    this.setData({ loading: true })
    try {
      await this.loadAllOrders()
      this.rebuildCalendar(true)
    } catch (err) {
      wx.showToast({ title: '加载历史失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadAllOrders() {
    const pageSize = 60
    let page = 1
    let hasMore = true
    let guard = 0
    const list = []

    while (hasMore && guard < 20) {
      guard += 1
      const res = await apiStore.getOrderList({ status: '', page, pageSize })
      const rows = Array.isArray(res.list) ? res.list : []
      list.push(...rows)
      hasMore = !!res.hasMore && rows.length > 0
      page += 1
      if (rows.length < pageSize && !res.hasMore) {
        break
      }
    }

    this.allOrders = list.map((order) => {
      const dateKey = toDateKey(order.date)
      const dateStr = apiStore.formatDate(order.date)
      return {
        ...order,
        dateKey,
        dateStr,
        itemsText: itemText(order.items),
        statusText: this.data.statusMap[order.status] || order.status || '未知状态'
      }
    })
  },

  rebuildCalendar(resetSelection = false) {
    const monthDate = new Date(this.currentMonthDate)
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const mondayStartOffset = (firstDay.getDay() + 6) % 7

    const dateCountMap = {}
    this.allOrders.forEach((order) => {
      const key = order.dateKey
      dateCountMap[key] = (dateCountMap[key] || 0) + 1
    })

    const days = []
    for (let i = 0; i < mondayStartOffset; i += 1) {
      days.push({ key: `empty_${i}`, day: '', isEmpty: true })
    }

    const todayKey = toDateKey(Date.now())
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`
      const count = Number(dateCountMap[dateKey] || 0)
      days.push({
        key: dateKey,
        dateKey,
        day,
        isEmpty: false,
        hasHistory: count > 0,
        count,
        isToday: dateKey === todayKey
      })
    }

    while (days.length % 7 !== 0) {
      days.push({ key: `tail_${days.length}`, day: '', isEmpty: true })
    }

    let selectedDateKey = this.data.selectedDateKey
    if (resetSelection || !selectedDateKey) {
      const todayInMonth = `${year}-${pad(month + 1)}-${pad(new Date().getDate())}`
      if (dateCountMap[todayInMonth]) {
        selectedDateKey = todayInMonth
      } else {
        const firstWithHistory = days.find((it) => !it.isEmpty && it.hasHistory)
        selectedDateKey = firstWithHistory ? firstWithHistory.dateKey : `${year}-${pad(month + 1)}-01`
      }
    }

    const selectedOrders = this.allOrders
      .filter((order) => order.dateKey === selectedDateKey)
      .sort((a, b) => Number(b.date || 0) - Number(a.date || 0))

    const calendarDays = days.map((it) => {
      if (it.isEmpty) return it
      return {
        ...it,
        isSelected: it.dateKey === selectedDateKey
      }
    })

    this.setData({
      currentMonth: monthText(monthDate),
      dateCountMap,
      calendarDays,
      selectedDateKey,
      selectedOrders
    })
  },

  handlePrevMonth() {
    const d = new Date(this.currentMonthDate)
    d.setMonth(d.getMonth() - 1)
    d.setDate(1)
    this.currentMonthDate = d
    this.rebuildCalendar(true)
  },

  handleNextMonth() {
    const d = new Date(this.currentMonthDate)
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
    this.currentMonthDate = d
    this.rebuildCalendar(true)
  },

  handleSelectDay(e) {
    const { datekey } = e.currentTarget.dataset
    if (!datekey || datekey === this.data.selectedDateKey) return
    const selectedOrders = this.allOrders
      .filter((order) => order.dateKey === datekey)
      .sort((a, b) => Number(b.date || 0) - Number(a.date || 0))

    const calendarDays = this.data.calendarDays.map((it) => {
      if (it.isEmpty) return it
      return { ...it, isSelected: it.dateKey === datekey }
    })

    this.setData({ selectedDateKey: datekey, selectedOrders, calendarDays })
  },

  viewOrderDetail(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    wx.navigateTo({ url: `/pages/OrderDetail/OrderDetail?id=${id}` })
  },

  handleBack() {
    wx.navigateBack()
  },

  noop() {},

  reorderOrder(e) {
    const { id } = e.currentTarget.dataset
    if (!id) return
    const current = (this.data.selectedOrders || []).find((it) => it._id === id) || (this.allOrders || []).find((it) => it._id === id)
    if (!current || !Array.isArray(current.items) || !current.items.length) {
      wx.showToast({ title: '该订单无可下单菜品', icon: 'none' })
      return
    }

    const cart = cartStore.getCart()
    const seed = Date.now()
    current.items.forEach((item, idx) => {
      const menuId = String(item.menuId || item._id || '').trim() || `calendar_${id}_${seed}_${idx}`
      const menu = {
        _id: menuId,
        title: item.title || '未知菜品',
        image: item.image || ''
      }
      const addCount = Math.max(1, Number(item.count || 0))
      if (cart[menuId]) {
        cart[menuId].count = Number(cart[menuId].count || 0) + addCount
      } else {
        cart[menuId] = { menu, count: addCount }
      }
    })

    cartStore.setCart(cart)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/Order/Order' })
    }, 220)
  }
})
