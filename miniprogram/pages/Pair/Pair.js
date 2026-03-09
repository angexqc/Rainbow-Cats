const apiStore = require('../../utils/apiStore')

Page({
  data: {
    statusBarHeight: 20,
    headerHeight: 56,
    isPaired: false,
    pairCode: '',
    qrImageUrl: '',
    inputCode: '',
    canBind: false,
    partnerInfo: {
      nickName: '',
      avatarUrl: '',
      bindTime: ''
    },
    wxIdentity: null
  },

  getWxId() {
    const identity = apiStore.getWxIdentity()
    return String((identity && identity.wxId) || 'guest')
  },

  makeQrImageUrl(code) {
    if (!code) return ''
    const payload = encodeURIComponent(`RAINBOW_PAIR:${code}`)
    return `https://quickchart.io/qr?text=${payload}&size=260`
  },

  onLoad() {
    this.setupHeaderLayout()
    const identity = apiStore.getWxIdentity()
    this.setData({ wxIdentity: identity || null })
    this.loadPairInfo()
  },

  onShow() {
    this.loadPairInfo()
  },

  setupHeaderLayout() {
    try {
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
      const statusBarHeight = Number((menu && menu.top) || sys.statusBarHeight || 20)
      const navHeight = Number((menu && menu.height) || 32)
      const headerHeight = statusBarHeight + navHeight + 10
      this.setData({ statusBarHeight, headerHeight })
    } catch (err) {
      this.setData({ statusBarHeight: 20, headerHeight: 62 })
    }
  },

  async loadPairInfo() {
    try {
      const pair = await apiStore.getPairInfo()
      const identity = apiStore.getWxIdentity()
      const shownCode = pair.pairCode || (identity && identity.pairCode) || ''
      this.setData({
        isPaired: pair.isPaired,
        pairCode: shownCode,
        qrImageUrl: this.makeQrImageUrl(shownCode),
        partnerInfo: pair.partnerInfo || {}
      })
      if (!shownCode) {
        await this.generatePairCode()
      }
    } catch (err) {
      wx.showToast({ title: '加载配对信息失败', icon: 'none' })
    }
  },

  async generatePairCode() {
    try {
      const code = await apiStore.generatePairCode(this.getWxId())
      this.setData({ pairCode: code, qrImageUrl: this.makeQrImageUrl(code) })
    } catch (err) {
      wx.showToast({ title: '生成配对码失败', icon: 'none' })
    }
  },

  onCodeInput(e) {
    const value = String((e.detail && e.detail.value) || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8)
    this.setData({ inputCode: value, canBind: value.length === 8 })
  },

  async handleBind() {
    const code = (this.data.inputCode || '').trim()
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      wx.showToast({ title: '请输入8位配对码', icon: 'none' })
      return
    }

    try {
      await apiStore.bindPair(code)
      wx.showToast({ title: '绑定成功', icon: 'success' })
      this.setData({ inputCode: '', canBind: false })
      await this.loadPairInfo()
      setTimeout(() => {
        wx.switchTab({ url: '/pages/Home/index' })
      }, 300)
    } catch (err) {
      const bizCode = Number(err && err.bizCode)
      if (bizCode === 14001) {
        wx.showToast({ title: '配对码不存在', icon: 'none' })
        return
      }
      if (bizCode === 14002) {
        wx.showToast({ title: '对方已有关联人员', icon: 'none' })
        return
      }
      if (bizCode === 14003) {
        wx.showToast({ title: '你已经绑定过了', icon: 'none' })
        return
      }
      if (bizCode === 14004) {
        wx.showToast({ title: '不能绑定自己', icon: 'none' })
        return
      }
      wx.showToast({ title: '绑定失败', icon: 'none' })
    }
  },

  handleSkipPairing() {
    apiStore.skipPairing()
    wx.showToast({ title: '已按单人模式进入', icon: 'none' })
    setTimeout(() => {
      wx.switchTab({ url: '/pages/Home/index' })
    }, 250)
  },

  parseScannedCode(text) {
    const raw = String(text || '').trim()
    if (!raw) return ''
    if (raw.startsWith('RAINBOW_PAIR:')) {
      return raw.replace('RAINBOW_PAIR:', '').trim().toUpperCase()
    }
    const codeMatch = raw.match(/[A-Z0-9]{8}/i)
    if (codeMatch && codeMatch[0]) return codeMatch[0].toUpperCase()
    try {
      const q = raw.split('?')[1] || ''
      const query = {}
      q.split('&').forEach((kv) => {
        const [k, v] = kv.split('=')
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '')
      })
      if (query.code) return String(query.code).toUpperCase()
    } catch (err) {
      return ''
    }
    return ''
  },

  scanToBind() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const parsed = this.parseScannedCode((res && res.result) || '')
        if (!/^[A-Z0-9]{8}$/.test(parsed)) {
          wx.showToast({ title: '未识别到有效配对码', icon: 'none' })
          return
        }
        this.setData({ inputCode: parsed })
        this.setData({ canBind: true })
        this.handleBind()
      },
      fail: () => {
        wx.showToast({ title: '扫码已取消', icon: 'none' })
      }
    })
  },

  copyPairCode() {
    if (!this.data.pairCode) return
    wx.setClipboardData({
      data: this.data.pairCode
    })
  },

  handleUnbind() {
    wx.showModal({
      title: '确认解除绑定',
      content: '解除绑定后，双方将无法共享菜单和点单记录。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await apiStore.unbindPair()
          wx.showToast({ title: '已解除绑定', icon: 'success' })
          this.loadPairInfo()
        } catch (err) {
          wx.showToast({ title: '解绑失败', icon: 'none' })
        }
      }
    })
  }
})
