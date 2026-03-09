const apiStore = require('../../utils/apiStore')
const { uploadImage } = require('../../services/upload')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    nickName: '',
    avatarUrl: '',
    saving: false,
    fromMy: false
  },

  async onLoad(options = {}) {
    const fromMy = String((options && options.from) || '') === 'my'
    this.setData({ topSafeHeight: getTopSafeHeight() })
    if (fromMy) this.setData({ fromMy: true })
    await this.loadMyProfile()
  },

  async loadMyProfile() {
    try {
      const profile = await apiStore.getMyProfile()
      this.setData({
        nickName: String((profile && profile.nickName) || '').trim(),
        avatarUrl: String((profile && profile.avatarUrl) || '').trim()
      })
    } catch (err) {
      // keep defaults
    }
  },

  onNickInput(e) {
    this.setData({ nickName: String((e.detail && e.detail.value) || '').trim() })
  },

  normalizeWechatAvatar(url = '') {
    const raw = String(url || '').trim()
    if (!raw) return ''
    // WeChat avatar links often end with /132 (compressed). Use /0 for original size.
    return raw.replace(/\/(132|96|64|46|0)$/, '/0')
  },

  async chooseAvatarUpload() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.tempFilePath) return
        wx.showLoading({ title: '上传中...', mask: true })
        try {
          const url = await uploadImage(file.tempFilePath, 'avatars')
          this.setData({ avatarUrl: url })
          wx.showToast({ title: '头像已上传', icon: 'success' })
        } catch (err) {
          wx.showModal({
            title: '上传失败',
            content: String((err && err.message) || '上传失败'),
            showCancel: false
          })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  async chooseWechatAvatar(e) {
    const tempPath = String((e && e.detail && e.detail.avatarUrl) || '').trim()
    if (!tempPath) {
      wx.showToast({ title: '未获取到微信头像', icon: 'none' })
      return
    }
    wx.showLoading({ title: '上传中...', mask: true })
    try {
      const url = await uploadImage(tempPath, 'avatars')
      this.setData({ avatarUrl: url })
      wx.showToast({ title: '微信头像已更新', icon: 'success' })
    } catch (err) {
      wx.showModal({
        title: '上传失败',
        content: String((err && err.message) || '上传失败'),
        showCancel: false
      })
    } finally {
      wx.hideLoading()
    }
  },

  fillFromWechat() {
    if (typeof wx.getUserProfile !== 'function') {
      wx.showModal({
        title: '当前环境不支持',
        content: '微信基础库不支持 wx.getUserProfile，请升级微信后重试。',
        showCancel: false
      })
      return
    }

    wx.getUserProfile({
      desc: '用于完善昵称和头像',
      lang: 'zh_CN',
      success: (res) => {
        const userInfo = (res && res.userInfo) || {}
        const nickName = String(userInfo.nickName || '').trim()
        const avatarUrl = this.normalizeWechatAvatar(String(userInfo.avatarUrl || '').trim())
        if (!nickName || /^微信用户/i.test(nickName)) {
          wx.showModal({
            title: '昵称需手动填写',
            content: '微信接口返回了匿名昵称“微信用户”，请在输入框填写你的昵称。',
            showCancel: false
          })
          if (avatarUrl) this.setData({ avatarUrl })
          return
        }
        if (!avatarUrl) {
          wx.showModal({
            title: '获取失败',
            content: '微信未返回头像，请点击“使用微信头像”或“上传头像”。',
            showCancel: false
          })
          return
        }
        this.setData({ nickName, avatarUrl })
        wx.showToast({ title: '已填充微信资料', icon: 'success' })
      },
      fail: (err) => {
        const errMsg = String((err && err.errMsg) || '未知错误')
        wx.showModal({
          title: '获取微信资料失败',
          content: errMsg,
          showCancel: false
        })
      }
    })
  },

  async saveProfile() {
    const nickName = String(this.data.nickName || '').trim()
    const avatarUrl = String(this.data.avatarUrl || '').trim()
    if (!nickName) {
      wx.showToast({ title: '请先输入昵称', icon: 'none' })
      return
    }
    if (!avatarUrl) {
      wx.showToast({ title: '请先上传头像', icon: 'none' })
      return
    }
    if (/^微信用户/i.test(nickName)) {
      wx.showToast({ title: '请填写真实昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await apiStore.updateMyProfile({ nickName, avatarUrl })
      wx.showToast({ title: '资料已保存', icon: 'success' })
      setTimeout(() => {
        if (this.data.fromMy) {
          const pages = getCurrentPages()
          if (Array.isArray(pages) && pages.length > 1) {
            wx.navigateBack()
            return
          }
          wx.switchTab({ url: '/pages/My/My' })
          return
        }
        wx.reLaunch({ url: '/pages/Pair/Pair' })
      }, 300)
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
