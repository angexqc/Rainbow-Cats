const apiStore = require('../../utils/apiStore')
const { getTopSafeHeight } = require('../../utils/safeArea')

Page({
  data: {
    topSafeHeight: 0,
    loading: false,
    notifyEnabled: false,
    wxBound: false,
    wechatConfigured: false,
    templateConfigured: false,
    templateOrderCreated: '',
    templateList: [],
    templatePickerOptions: [],
    selectedTemplateIndex: -1,
    selectedTemplatePreview: null
  },

  onLoad() {
    this.setData({ topSafeHeight: getTopSafeHeight() })
    this.loadSettings()
  },

  onShow() {
    this.loadSettings()
  },

  async loadSettings() {
    this.setData({ loading: true })
    try {
      const [settings, templatesRes] = await Promise.all([
        apiStore.getNotifySettings(),
        apiStore.getNotifyTemplates()
      ])
      const templateOrderCreated = String((settings && settings.templateOrderCreated) || '')
      const templateList = Array.isArray(templatesRes && templatesRes.templates) ? templatesRes.templates : []
      const templatePickerOptions = templateList.map((item) => String(item.title || item.id || '未命名模板'))
      let selectedTemplateIndex = templateList.findIndex((item) => String(item.id) === templateOrderCreated)
      if (selectedTemplateIndex < 0 && templateList.length > 0) selectedTemplateIndex = 0
      const selectedTemplatePreview = selectedTemplateIndex >= 0 ? templateList[selectedTemplateIndex] : null
      this.setData({
        notifyEnabled: !!(settings && settings.notifyEnabled),
        wxBound: !!(settings && settings.wxOpenId),
        wechatConfigured: !!(settings && settings.wechatConfigured),
        templateConfigured: !!templateOrderCreated,
        templateOrderCreated,
        templateList,
        templatePickerOptions,
        selectedTemplateIndex,
        selectedTemplatePreview
      })
    } catch (err) {
      wx.showToast({ title: '加载通知设置失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  handleBack() {
    wx.navigateBack()
  },

  async bindWeChatIdentity() {
    try {
      wx.showLoading({ title: '绑定中...', mask: true })
      await apiStore.bindNotifyWxSessionWithLoginCode()
      await this.loadSettings()
      wx.showToast({ title: '微信身份已绑定', icon: 'success' })
      return true
    } catch (err) {
      wx.showToast({ title: '绑定失败', icon: 'none' })
      return false
    } finally {
      wx.hideLoading()
    }
  },

  async handleSwitchChange(e) {
    const next = !!(e.detail && e.detail.value)
    if (!next) {
      try {
        await apiStore.updateNotifySettings({ notifyEnabled: false })
        this.setData({ notifyEnabled: false })
      } catch (err) {
        wx.showToast({ title: '关闭失败', icon: 'none' })
      }
      return
    }

    if (!this.data.wxBound) {
      const ok = await this.bindWeChatIdentity()
      if (!ok || !this.data.wxBound) {
        this.setData({ notifyEnabled: false })
        return
      }
    }
    if (!this.data.templateConfigured) {
      wx.showToast({ title: '服务端未配置模板ID', icon: 'none' })
      this.setData({ notifyEnabled: false })
      return
    }

    const subscribeRes = await apiStore.requestOrderSubscribeAuthorization()
    if (!subscribeRes.accepted) {
      const state = String(subscribeRes.state || subscribeRes.reason || '')
      const tip = state === 'reject' ? '你已拒绝订阅消息' : '订阅授权失败，请重试'
      wx.showToast({ title: tip, icon: 'none' })
      this.setData({ notifyEnabled: false })
      return
    }

    try {
      await apiStore.updateNotifySettings({ notifyEnabled: true })
      this.setData({ notifyEnabled: true })
      wx.showToast({ title: '已开启下单通知', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '开启失败', icon: 'none' })
      this.setData({ notifyEnabled: false })
    }
  },

  onTemplatePickChange(e) {
    const idx = Number((e.detail && e.detail.value) || -1)
    const list = this.data.templateList || []
    const selected = idx >= 0 && idx < list.length ? list[idx] : null
    this.setData({
      selectedTemplateIndex: idx,
      selectedTemplatePreview: selected,
      templateOrderCreated: selected ? String(selected.id || '') : ''
    })
  },

  async saveTemplateId() {
    const templateId = String(this.data.templateOrderCreated || '').trim()
    if (!templateId) {
      wx.showToast({ title: '请先选择模板', icon: 'none' })
      return
    }
    try {
      wx.showLoading({ title: '保存中...', mask: true })
      await apiStore.updateNotifySettings({ templateOrderCreated: templateId })
      await this.loadSettings()
      wx.showToast({ title: '模板ID已保存', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async sendTestNotify() {
    try {
      wx.showLoading({ title: '发送中...', mask: true })
      const res = await apiStore.sendNotifyTest()
      if (res && res.sent) {
        wx.showToast({ title: '测试消息已发送', icon: 'success' })
        return
      }
      const reasonMap = {
        OPENID_MISSING: '未绑定微信身份',
        NOTIFY_DISABLED: '通知开关未开启',
        TEMPLATE_MISSING: '未配置模板ID'
      }
      wx.showModal({
        title: '测试通知未发送',
        content: reasonMap[String((res && res.reason) || '')] || `未发送，原因：${String((res && res.reason) || 'UNKNOWN')}`,
        showCancel: false
      })
    } catch (err) {
      wx.showModal({
        title: '测试发送失败',
        content: String((err && err.message) || '请求异常'),
        showCancel: false
      })
    } finally {
      wx.hideLoading()
    }
  }
})
