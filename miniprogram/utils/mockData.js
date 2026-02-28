// Mock seed data for menu-order feature only.
// TODO: 与产品确认最终字段（口味、规格、库存、营业时段）后扩展菜单结构。
// TODO: 接入真实用户体系后，将 owner 从 me/ta 替换为用户 ID。

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1000&q=80'
]

const BANNERS = [
  'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=1400&q=80'
]

function createDefaultMenus() {
  return [
    {
      _id: 'm_1001',
      title: '珍珠奶茶',
      image: SAMPLE_IMAGES[0],
      desc: '三分糖、少冰，经典奶香口感。',
      category: 'drink',
      available: true,
      owner: 'me'
    },
    {
      _id: 'm_1002',
      title: '香辣鸡腿堡',
      image: SAMPLE_IMAGES[1],
      desc: '外酥里嫩，微辣风味。',
      category: 'main',
      available: true,
      owner: 'ta'
    },
    {
      _id: 'm_1003',
      title: '芒果布丁',
      image: SAMPLE_IMAGES[2],
      desc: '果香清甜，餐后解腻。',
      category: 'dessert',
      available: true,
      owner: 'me'
    },
    {
      _id: 'm_1004',
      title: '烤鸡沙拉',
      image: SAMPLE_IMAGES[3],
      desc: '轻食组合，均衡搭配。',
      category: 'other',
      available: true,
      owner: 'ta'
    }
  ]
}

function createOrder(orderId, daysAgo, status, items) {
  const now = Date.now()
  const date = now - (daysAgo * 24 * 60 * 60 * 1000)
  const totalCount = items.reduce((sum, it) => sum + Number(it.count || 0), 0)
  return {
    _id: orderId,
    status,
    creatorRole: 'me',
    date,
    confirmTime: ['confirmed', 'completed'].includes(status) ? date + 30 * 60 * 1000 : null,
    completeTime: status === 'completed' ? date + 2 * 60 * 60 * 1000 : null,
    items,
    totalCount,
    remark: ''
  }
}

function createDefaultOrders(menus) {
  const byId = {}
  menus.forEach((m) => { byId[m._id] = m })

  const item = (menuId, count) => ({
    menuId,
    title: byId[menuId].title,
    image: byId[menuId].image,
    desc: byId[menuId].desc,
    count
  })

  return [
    createOrder('o_3001', 2, 'completed', [item('m_1001', 2), item('m_1002', 1)]),
    createOrder('o_3002', 5, 'completed', [item('m_1002', 1), item('m_1003', 2)]),
    createOrder('o_3003', 9, 'confirmed', [item('m_1001', 1), item('m_1004', 1)]),
    createOrder('o_3004', 18, 'completed', [item('m_1002', 2)]),
    createOrder('o_3005', 25, 'cancelled', [item('m_1003', 1)]),
    createOrder('o_3006', 44, 'completed', [item('m_1001', 3)]),
    createOrder('o_3007', 73, 'completed', [item('m_1004', 2), item('m_1002', 1)]),
    createOrder('o_3008', 130, 'completed', [item('m_1001', 1), item('m_1003', 1)]),
    createOrder('o_3009', 210, 'completed', [item('m_1002', 1)]),
    createOrder('o_3010', 312, 'completed', [item('m_1001', 2), item('m_1004', 1)])
  ]
}

function createDefaultPair() {
  return {
    isPaired: false,
    pairCode: '123456',
    myInfo: {
      nickName: '卡比',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
    },
    partnerInfo: {
      nickName: '瓦豆',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
      bindTime: ''
    }
  }
}

function createDefaultMockDB() {
  const menus = createDefaultMenus()
  return {
    version: 4,
    banners: BANNERS,
    pair: createDefaultPair(),
    menus,
    orders: createDefaultOrders(menus),
    nextMenuSeq: 2000,
    nextOrderSeq: 3010
  }
}

module.exports = {
  createDefaultMockDB
}
