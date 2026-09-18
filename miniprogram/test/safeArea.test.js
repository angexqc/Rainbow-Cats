const test = require('node:test')
const assert = require('node:assert/strict')

function loadSafeArea(info) {
  global.wx = {
    getSystemInfoSync: () => info,
    getWindowInfo: () => info,
    getMenuButtonBoundingClientRect: () => info.menuButton || null
  }
  const path = require.resolve('../utils/safeArea')
  delete require.cache[path]
  return require('../utils/safeArea')
}

test('页面内容高度严格扣除胶囊下沿、64px 头部和底部 tabbar', () => {
  const safeArea = loadSafeArea({
    screenHeight: 844,
    windowHeight: 717,
    statusBarHeight: 44,
    safeArea: { bottom: 810 }
  })

  assert.equal(safeArea.getTopSafeHeight(), 52)
  assert.equal(safeArea.getContentTopSafeHeight(), 92)
  const result = safeArea.computeContentHeight({ topSafeHeight: 52, headerBodyHeight: 64 })
  assert.equal(result.tabBarHeight, 83)
  assert.equal(result.contentHeight, 645)
})

test('胶囊安全边界使用当前机型的真实 left 坐标', () => {
  const safeArea = loadSafeArea({
    screenWidth: 390,
    windowWidth: 390,
    statusBarHeight: 47,
    screenHeight: 844,
    windowHeight: 717,
    safeArea: { bottom: 810 },
    menuButton: { left: 296, right: 383, top: 51, bottom: 83, width: 87, height: 32 }
  })
  assert.deepEqual(safeArea.getCapsuleMetrics(), {
    left: 296, right: 7, top: 51, bottom: 83, width: 87, height: 32, safeRight: 102
  })
})

test('首页滚动区不重复扣顶部状态栏，订单操作栏单独扣除', () => {
  const safeArea = loadSafeArea({
    screenHeight: 844,
    windowHeight: 717,
    statusBarHeight: 44,
    safeArea: { bottom: 810 }
  })

  assert.equal(safeArea.computeTopSafeTabPageContentHeight().contentHeight, 761)
  assert.equal(safeArea.computeContentHeight({ topSafeHeight: 52, bottomBarHeight: 72 }).contentHeight, 573)
})

test('胶囊不可用时仍预留完整胶囊行', () => {
  const safeArea = loadSafeArea({ statusBarHeight: 24, screenHeight: 800, windowHeight: 700, safeArea: { bottom: 780 } })
  assert.equal(safeArea.getTopSafeHeight(), 52)
})

test('新基础库存在 getWindowInfo 时不调用废弃 getSystemInfoSync', () => {
  let legacyCalls = 0
  global.wx = {
    getWindowInfo: () => ({ windowWidth: 390, screenWidth: 390, statusBarHeight: 47 }),
    getSystemInfoSync: () => { legacyCalls += 1; return {} },
    getMenuButtonBoundingClientRect: () => ({ left: 296, right: 383, top: 51, bottom: 83, width: 87, height: 32 })
  }
  const path = require.resolve('../utils/safeArea')
  delete require.cache[path]
  const safeArea = require('../utils/safeArea')
  assert.equal(safeArea.getTopSafeHeight(), 65)
  assert.equal(safeArea.getContentTopSafeHeight(), 92)
  assert.equal(safeArea.getCapsuleMetrics().safeRight, 102)
  assert.equal(legacyCalls, 0)
})
