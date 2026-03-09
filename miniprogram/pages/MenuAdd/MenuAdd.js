const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const app = getApp()
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    title: '',
    image: '',
    desc: '',
    categories: [],
    categoryValues: [],
    categoryIndex: 0,
    available: true
  },

  onLoad() {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.refreshCategories()
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

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ desc: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPath = (res.tempFilePaths && res.tempFilePaths[0]) || ''
        if (!tempPath) {
          wx.showToast({ title: '未获取到图片', icon: 'none' })
          return
        }
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
        const msg = String((err && err.errMsg) || '')
        if (msg.includes('cancel')) {
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

    try {
      await apiStore.addMenu({
        title,
        image: this.data.image,
        desc: this.data.desc,
        category: this.data.categoryValues[this.data.categoryIndex],
        available: this.data.available
      })

      wx.showToast({ title: '添加成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  }
})
