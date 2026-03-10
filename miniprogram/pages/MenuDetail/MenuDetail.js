const app = getApp()
const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    menuId: '',
    menu: null,
    isCreator: false,
    selfUserId: '',
    categoryMap: app.globalData ? app.globalData.menuCategoryMap : {
      main: '主食',
      drink: '饮品',
      dessert: '甜点',
      other: '其他'
    }
  },

  onLoad(options) {
    const { id } = options
    const identity = apiStore.getWxIdentity() || {}
    this.setData({
      menuId: id,
      topSafeHeight: getTopSafeHeight(),
      selfUserId: String(identity.userId || '')
    })
    this.loadMenuDetail(id)
  },

  onShow() {
    if (this.data.menuId) this.loadMenuDetail(this.data.menuId)
  },

  resolveCategoryLabel(itemOrKey) {
    if (itemOrKey && typeof itemOrKey === 'object') {
      const directLabel = String(itemOrKey.categoryLabel || '').trim()
      if (directLabel) return directLabel
    }
    const rawKey = String((itemOrKey && itemOrKey.category) || itemOrKey || '').trim()
    const map = this.data.categoryMap || {}
    const fromMap = String(map[rawKey] || '').trim()
    if (fromMap) return fromMap
    if (rawKey.startsWith('custom_')) return '自定义分类'
    return rawKey || '未分类'
  },

  async loadMenuDetail(id) {
    try {
      await apiStore.syncMenuCategoryMapFromMenus({ force: false })
      this.setData({
        categoryMap: app.globalData ? app.globalData.menuCategoryMap : this.data.categoryMap
      })
      const menu = await apiStore.getMenuById(id)
      if (!menu) {
        wx.showToast({ title: '菜品不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
        return
      }

      this.setData({
        menu: {
          ...menu,
          ownerRole: String(menu.owner) === String(this.data.selfUserId) ? 'me' : 'ta',
          ownerDisplayName: String(menu.ownerName || '') || (String(menu.owner) === String(this.data.selfUserId) ? '我' : '对方'),
          ownerDisplayAvatar: String(menu.ownerAvatar || ''),
          categoryDisplay: this.resolveCategoryLabel(menu)
        },
        isCreator: String(menu.owner) === String(this.data.selfUserId)
      })
    } catch (err) {
      wx.showToast({ title: '加载菜品失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
    }
  },

  handleBack() {
    wx.navigateBack()
  },

  previewImage() {
    const { menu } = this.data
    if (!menu || !menu.image) return
    wx.previewImage({
      urls: [menu.image],
      current: menu.image
    })
  },

  handleEdit() {
    wx.navigateTo({ url: `/pages/MenuEdit/MenuEdit?id=${this.data.menuId}` })
  },

  async handleToggleAvailable() {
    const { menu } = this.data
    const next = !menu.available
    try {
      await apiStore.toggleMenuStatus(this.data.menuId, next)
      wx.showToast({ title: next ? '已上架' : '已下架', icon: 'success' })
      this.loadMenuDetail(this.data.menuId)
    } catch (err) {
      wx.showToast({ title: '状态更新失败', icon: 'none' })
    }
  },

  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.deleteMenu(this.data.menuId)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }
})
