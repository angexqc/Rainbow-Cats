const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const app = getApp()
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    menuId: '',
    title: '',
    image: '',
    desc: '',
    categories: [],
    categoryValues: [],
    categoryIndex: 0,
    available: true,
    menu: true
  },

  onLoad(options) {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.refreshCategories()
    const { id } = options
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }

    this.setData({ menuId: id })
    this.loadMenuDetail(id)
  },

  refreshCategories() {
    const map = (app.globalData && app.globalData.menuCategoryMap) || {}
    const categoryValues = Object.keys(map)
    const categories = categoryValues.map((k) => map[k] || k)
    this.setData({
      categories,
      categoryValues,
      categoryIndex: Math.min(this.data.categoryIndex, Math.max(0, categoryValues.length - 1))
    })
  },

  async loadMenuDetail(id) {
    try {
      const menu = await apiStore.getMenuById(id)
      if (!menu) {
        wx.showToast({ title: '菜品不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
        return
      }

      const hasCategory = this.data.categoryValues.includes(menu.category)
      if (!hasCategory) {
        const appMap = (app.globalData && app.globalData.menuCategoryMap) || {}
        const nextMap = { ...appMap, [menu.category]: String(menu.categoryLabel || menu.category) }
        if (app.globalData) app.globalData.menuCategoryMap = nextMap
        wx.setStorageSync('menuCategoryMap', nextMap)
        this.refreshCategories()
      }
      const categoryIndex = Math.max(0, this.data.categoryValues.indexOf(menu.category))
      this.setData({
        title: menu.title,
        image: menu.image,
        desc: menu.desc || '',
        categoryIndex,
        available: !!menu.available,
        menu: true
      })
    } catch (err) {
      wx.showToast({ title: '加载菜品失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ desc: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onToggleAvailable(e) {
    this.setData({ available: !!e.detail.value })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFilePaths && res.tempFilePaths[0]
        if (!tempPath) return
        wx.showLoading({ title: '上传中...', mask: true })
        try {
          const url = await uploadImage(tempPath, 'menus')
          this.setData({ image: url })
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (err) {
          const msg = String((err && err.message) || '上传失败')
          wx.showToast({ title: msg.slice(0, 16), icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      },
      fail: (err) => {
        if (err && /cancel/i.test(String(err.errMsg || ''))) {
          wx.showToast({ title: '已取消选择', icon: 'none' })
          return
        }
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  handleCancel() {
    wx.navigateBack()
  },

  async handleSave() {
    const title = (this.data.title || '').trim()

    if (!title) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }
    if (!this.data.image) {
      wx.showToast({ title: '请上传菜品图片', icon: 'none' })
      return
    }

    const category = this.data.categoryValues[this.data.categoryIndex] || 'other'
    const categoryLabel = this.data.categories[this.data.categoryIndex] || category
    try {
      await apiStore.updateMenu(this.data.menuId, {
        title,
        image: this.data.image,
        desc: this.data.desc,
        category,
        categoryLabel,
        available: this.data.available
      })

      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
