const apiStore = require('../../utils/apiStore')
const cartStore = require('../../utils/cartStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: { topSafeHeight: 0, loading: false, tab: 'favorite', list: [] },
  onLoad() { this.setData({ topSafeHeight: getTopSafeHeight() }); this.load() },
  onShow() { if (this.data.list.length) this.load() },
  handleBack() { wx.navigateBack() },
  switchTab(e) { const tab = e.currentTarget.dataset.tab; if (tab !== this.data.tab) { this.setData({ tab }); this.load() } },
  async load() {
    this.setData({ loading: true })
    try { this.setData({ list: await apiStore.getMenuMarks(this.data.tab) || [] }) }
    catch (err) { wx.showToast({ title: '加载失败', icon: 'none' }) }
    finally { this.setData({ loading: false }) }
  },
  async addCandidate(e) {
    try { await apiStore.addCandidate(e.currentTarget.dataset.id); wx.showToast({ title: '已加入候选', icon: 'success' }) }
    catch (err) { wx.showToast({ title: '加入失败', icon: 'none' }) }
  },
  addCart(e) {
    const mark = this.data.list.find((item) => item.menuId === e.currentTarget.dataset.id)
    if (!mark || !mark.menu.available) { wx.showToast({ title: '菜品已下架', icon: 'none' }); return }
    const cart = cartStore.getCart(), menu = mark.menu
    if (cart[menu._id]) cart[menu._id].count = Number(cart[menu._id].count || 0) + 1
    else cart[menu._id] = { menu, count: 1 }
    cartStore.setCart(cart); wx.showToast({ title: '已加入购物车', icon: 'success' })
  },
  async remove(e) {
    const menuId = e.currentTarget.dataset.id
    try { await apiStore.removeMenuMark(this.data.tab, menuId); this.setData({ list: this.data.list.filter((item) => item.menuId !== menuId) }) }
    catch (err) { wx.showToast({ title: '移除失败', icon: 'none' }) }
  }
})
