const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const { getTopSafeHeight } = require('../../utils/safeArea')

const DEFAULT_CATEGORY_MAP = {
  main: '主食',
  drink: '饮品',
  dessert: '甜点',
  other: '其他'
}
const CATEGORY_ORDER_KEY = 'menuCategoryOrder'

Page({
  data: {
    topSafeHeight: 0,
    banners: [],
    bannerCurrent: 0,
    categoryEntries: [],
    isPaired: false,
    draggingCategoryIndex: -1,
    dragPreviewIndex: -1,
    dragInsertIndex: -1
  },

  onLoad() {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.loadPageData()
  },

  onShow() {
    this.loadPageData()
  },

  async loadPageData() {
    try {
      await this.syncCategoryMapFromRemoteMenus()
      const [banners, pair] = await Promise.all([
        apiStore.getHomeBanners(),
        apiStore.getPairInfo()
      ])
      const normalizedBanners = this.normalizeBanners(banners)
      this.setData({
        banners: normalizedBanners,
        bannerCurrent: 0,
        categoryEntries: this.getCategoryEntries(),
        isPaired: !!(pair && pair.isPaired)
      })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async syncCategoryMapFromRemoteMenus() {
    const app = getApp()
    const baseMap = (app.globalData && app.globalData.menuCategoryMap) || DEFAULT_CATEGORY_MAP
    const nextMap = { ...baseMap }
    let page = 1
    const pageSize = 100
    while (true) {
      const res = await apiStore.getMenuList({ page, pageSize })
      const list = Array.isArray(res.list) ? res.list : []
      list.forEach((item) => {
        const key = String((item && item.category) || '').trim()
        if (!key) return
        const label = String((item && item.categoryLabel) || '').trim()
        if (label) {
          nextMap[key] = label
          return
        }
        if (!Object.prototype.hasOwnProperty.call(nextMap, key)) {
          nextMap[key] = key
        }
      })
      if (!res.hasMore) break
      page += 1
    }

    if (app.globalData) app.globalData.menuCategoryMap = nextMap
    wx.setStorageSync('menuCategoryMap', nextMap)
  },

  onBannerChange(e) {
    const current = (e.detail && Number(e.detail.current)) || 0
    this.setData({ bannerCurrent: current })
  },

  normalizeBanners(list = []) {
    return (Array.isArray(list) ? list : [])
      .map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `banner_${idx}_${item.slice(-12)}`, url: item }
        }
        if (item && typeof item === 'object' && item.url) {
          return { id: String(item.id || `banner_${idx}`), url: String(item.url) }
        }
        return null
      })
      .filter((item) => item && item.url)
  },

  getCategoryEntries() {
    const app = getApp()
    const map = (app.globalData && app.globalData.menuCategoryMap) || DEFAULT_CATEGORY_MAP
    return Object.keys(map).map((key) => ({
      key,
      label: map[key] || key
    }))
  },

  saveCategoryMapByEntries(entries = []) {
    const app = getApp()
    const source = Array.isArray(entries) ? entries : []
    const nextMap = {}
    const nextOrder = []
    source.forEach((item) => {
      const key = String((item && item.key) || '').trim()
      if (!key) return
      nextMap[key] = String((item && item.label) || key)
      nextOrder.push(key)
    })
    if (app.globalData) {
      app.globalData.menuCategoryMap = nextMap
    }
    wx.setStorageSync('menuCategoryMap', nextMap)
    wx.setStorageSync(CATEGORY_ORDER_KEY, nextOrder)
    this.setData({ categoryEntries: source })
  },

  async handleUploadBanner() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return

        wx.showLoading({ title: '上传中...', mask: true })
        try {
          const url = await uploadImage(file.tempFilePath, 'banners')
          await apiStore.addHomeBanner(url)
          await this.loadPageData()
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  previewBanner(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({
      current: url,
      urls: (this.data.banners || []).map((item) => item.url).filter(Boolean)
    })
  },

  deleteBanner(e) {
    const url = e.currentTarget.dataset.url
    const idx = Number(e.currentTarget.dataset.idx)
    const targetUrl = url || ((this.data.banners[idx] && this.data.banners[idx].url) || '')
    if (!targetUrl) return
    wx.showModal({
      title: '删除轮播图',
      content: '确认删除这张轮播图吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        try {
          await apiStore.deleteHomeBanner(targetUrl)
          await this.loadPageData()
          wx.showToast({ title: '删除成功', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  addCategory() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '输入分类名称，例如：小吃',
      success: async (res) => {
        if (!res.confirm) return
        const normalized = String(res.content || '').trim().slice(0, 16)
        if (!normalized) {
          wx.showToast({ title: '分类名不能为空', icon: 'none' })
          return
        }
        const key = this.makeReadableCategoryKey(normalized)
        await this.updateCategoryLabel(key, normalized)
      }
    })
  },

  editCategory(e) {
    const key = e.currentTarget.dataset.key
    const current = this.data.categoryEntries.find((it) => it.key === key)
    if (!current) return

    wx.showModal({
      title: '编辑分类',
      editable: true,
      placeholderText: '输入分类名称',
      content: current.label,
      success: async (res) => {
        if (!res.confirm) return
        const label = String(res.content || '').trim().slice(0, 16)
        if (!label) {
          wx.showToast({ title: '分类名不能为空', icon: 'none' })
          return
        }
        await this.updateCategoryLabel(key, label)
      }
    })
  },

  async migrateCategoryToOther(fromKey) {
    const sourceKey = String(fromKey || '').trim()
    if (!sourceKey || sourceKey === 'other') return

    const identity = apiStore.getWxIdentity() || {}
    const selfId = String(identity.userId || '')
    if (!selfId) return

    let page = 1
    const pageSize = 100
    const targetMenus = []
    while (true) {
      const res = await apiStore.getMenuList({ page, pageSize })
      const list = Array.isArray(res.list) ? res.list : []
      targetMenus.push(
        ...list.filter((m) => String((m && m.owner) || '') === selfId && String((m && m.category) || '') === sourceKey)
      )
      if (!res.hasMore) break
      page += 1
    }

    for (const menu of targetMenus) {
      await apiStore.updateMenu(menu._id, {
        title: menu.title,
        image: menu.image,
        desc: menu.desc || '',
        category: 'other',
        categoryLabel: '其他',
        available: !!menu.available
      })
    }
  },

  deleteCategory(e) {
    const key = String((e.currentTarget.dataset && e.currentTarget.dataset.key) || '').trim()
    if (!key) return
    if (key === 'other') {
      wx.showToast({ title: '“其他”不可删除', icon: 'none' })
      return
    }
    const current = this.data.categoryEntries.find((it) => it.key === key)
    if (!current) return

    wx.showModal({
      title: '删除分类',
      content: `删除后该分类下菜品将归为“其他”。确认删除“${current.label}”？`,
      success: async (res) => {
        if (!res.confirm) return
        const next = (this.data.categoryEntries || []).filter((it) => it.key !== key)
        this.saveCategoryMapByEntries(next)
        wx.showLoading({ title: '同步中...', mask: true })
        try {
          await this.migrateCategoryToOther(key)
          wx.showToast({ title: '分类已删除', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '分类已删，菜单同步失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  makeReadableCategoryKey(label) {
    const entries = this.getCategoryEntries()
    const base = String(label || '').trim().slice(0, 16)
    if (!base) return ''
    if (!entries.some((it) => it.key === base)) return base
    let seq = 2
    let candidate = `${base}_${seq}`
    while (entries.some((it) => it.key === candidate)) {
      seq += 1
      candidate = `${base}_${seq}`
    }
    return candidate
  },

  async syncCategoryLabel(key, label) {
    const targetKey = String(key || '').trim()
    const targetLabel = String(label || '').trim()
    if (!targetKey || !targetLabel) return

    const identity = apiStore.getWxIdentity() || {}
    const selfId = String(identity.userId || '')
    if (!selfId) return

    let page = 1
    const pageSize = 100
    const targetMenus = []
    while (true) {
      const res = await apiStore.getMenuList({ page, pageSize })
      const list = Array.isArray(res.list) ? res.list : []
      targetMenus.push(
        ...list.filter((m) => String((m && m.owner) || '') === selfId && String((m && m.category) || '') === targetKey)
      )
      if (!res.hasMore) break
      page += 1
    }

    for (const menu of targetMenus) {
      await apiStore.updateMenu(menu._id, {
        title: menu.title,
        image: menu.image,
        desc: menu.desc || '',
        category: targetKey,
        categoryLabel: targetLabel,
        available: !!menu.available
      })
    }
  },

  async updateCategoryLabel(key, label) {
    const current = this.getCategoryEntries()
    const index = current.findIndex((item) => item.key === key)
    const next = [...current]
    if (index >= 0) {
      next[index] = { ...next[index], label }
    } else {
      next.push({ key, label })
    }
    this.saveCategoryMapByEntries(next)
    if (index >= 0) {
      wx.showLoading({ title: '同步分类中...', mask: true })
      try {
        await this.syncCategoryLabel(key, label)
      } catch (err) {
        wx.showToast({ title: '分类名已改，但菜单同步失败', icon: 'none' })
      } finally {
        wx.hideLoading()
      }
    }
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  resetCategories() {
    const entries = Object.keys(DEFAULT_CATEGORY_MAP).map((key) => ({
      key,
      label: DEFAULT_CATEGORY_MAP[key]
    }))
    this.saveCategoryMapByEntries(entries)
    wx.showToast({ title: '已恢复默认', icon: 'success' })
  },

  onCategoryDragStart(e) {
    const idx = Number(e.currentTarget.dataset.index)
    const touch = e.touches && e.touches[0]
    if (!Number.isInteger(idx) || idx < 0 || !touch) return
    this.dragStartIndex = idx
    this.dragInsertIndex = idx
    this.collectCategoryItemRects()
    this.setData({ draggingCategoryIndex: idx, dragPreviewIndex: idx, dragInsertIndex: idx })
  },

  collectCategoryItemRects() {
    const query = wx.createSelectorQuery()
    query.selectAll('.category-item').boundingClientRect((rects) => {
      const source = Array.isArray(rects) ? rects : []
      this.categoryRects = source.map((rect) => ({
        top: Number(rect.top || 0),
        bottom: Number(rect.bottom || 0),
        center: (Number(rect.top || 0) + Number(rect.bottom || 0)) / 2
      }))
    })
    query.exec()
  },

  calcInsertIndexByY(y) {
    const entries = this.data.categoryEntries || []
    const rects = this.categoryRects || []
    const len = entries.length
    if (!len || !rects.length) return -1
    let insertIndex = len
    for (let i = 0; i < rects.length; i += 1) {
      if (y < rects[i].center) {
        insertIndex = i
        break
      }
    }
    return Math.max(0, Math.min(len, insertIndex))
  },

  onCategoryDragMove(e) {
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const startIndex = Number(this.dragStartIndex)
    if (!Number.isInteger(startIndex) || startIndex < 0) return
    const insertIndex = this.calcInsertIndexByY(Number(touch.clientY || 0))
    if (!Number.isInteger(insertIndex) || insertIndex < 0) return
    const targetIndex = Math.max(0, Math.min((this.data.categoryEntries || []).length - 1, insertIndex))
    if (insertIndex === this.dragInsertIndex && targetIndex === Number(this.data.dragPreviewIndex)) return
    this.dragInsertIndex = insertIndex
    this.setData({ dragInsertIndex: insertIndex, dragPreviewIndex: targetIndex })
  },

  onCategoryDragEnd() {
    const startIndex = Number(this.dragStartIndex)
    this.dragStartIndex = -1
    const insertIndex = Number(this.data.dragInsertIndex)
    this.dragInsertIndex = -1
    this.categoryRects = null
    this.setData({ draggingCategoryIndex: -1, dragPreviewIndex: -1, dragInsertIndex: -1 })

    if (!Number.isInteger(startIndex) || startIndex < 0) return
    const entries = [...this.data.categoryEntries]
    if (entries.length < 2) return

    if (!Number.isInteger(insertIndex) || insertIndex < 0) return
    let targetIndex = insertIndex > startIndex ? insertIndex - 1 : insertIndex
    if (targetIndex === startIndex) return
    targetIndex = Math.max(0, Math.min(entries.length - 1, targetIndex))

    const [moved] = entries.splice(startIndex, 1)
    entries.splice(targetIndex, 0, moved)
    this.saveCategoryMapByEntries(entries)
    wx.showToast({ title: '分类顺序已更新', icon: 'none' })
  },

  goPairing() {
    wx.reLaunch({ url: '/pages/Pair/Pair' })
  },

  goProfileSetup() {
    wx.navigateTo({ url: '/pages/ProfileSetup/index?from=my' })
  },

  unbindPair() {
    wx.showModal({
      title: '解除关联',
      content: '确认解除当前情侣关联吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.unbindPair()
          await this.loadPageData()
          wx.showToast({ title: '已解除关联', icon: 'success' })
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/Pair/Pair' })
          }, 500)
        } catch (err) {
          wx.showToast({ title: '解除失败', icon: 'none' })
        }
      }
    })
  }
})
