// cloudfunctions/orderManager/index.js
const cloud = require('wx-server-sdk').cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

const COLLECTION_NAME = 'OrderList'
const USER_COLLECTION = 'UserList'

/**
 * 创建订单
 */
exports.createOrder = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { items, totalCredit, remark } = event

  try {
    // 表单验证
    if (!items || items.length === 0) {
      return {
        success: false,
        message: '请选择菜品'
      }
    }
    if (!totalCredit || totalCredit <= 0) {
      return {
        success: false,
        message: '订单金额必须大于0'
      }
    }

    // 获取用户余额
    const user = await db.collection(USER_COLLECTION)
      .where({ _openid: OPENID })
      .get()

    if (user.length === 0) {
      return {
        success: false,
        message: '用户信息不存在'
      }
    }

    const balance = user[0].credit || 0

    // 余额检查
    if (totalCredit > balance) {
      return {
        success: false,
        message: `积分不足，当前余额${balance}，需要${totalCredit}`
      }
    }

    // 获取对方OpenId（通过情侣关系）
    const partnerPair = await db.collection('CoupleRelation')
      .where({
        status: 'active',
        _.or: [
          { openIdA: OPENID },
          { openIdB: OPENID }
        ]
      })
      .get()

    if (partnerPair.length === 0) {
      return {
        success: false,
        message: '请先绑定情侣'
      }
    }

    const pair = partnerPair[0]
    const partnerOpenId = pair.openIdA === OPENID ? pair.openIdB : pair.openIdA

    // 保存菜品快照
    const itemsSnapshot = items.map(item => ({
      menuId: item.menuId,
      title: item.title,
      image: item.image,
      desc: item.desc || '',
      credit: item.credit,
      count: item.count
    }))

    // 扣除积分
    await db.collection(USER_COLLECTION)
      .where({ _openid: OPENID })
      .update({
        credit: _.inc(-totalCredit)
      })

    // 创建订单
    const orderData = {
      creatorOpenId: OPENID,
      partnerOpenId,
      items: itemsSnapshot,
      totalCredit,
      remark: remark || '',
      status: 'pending',
      date: new Date()
    }

    const result = await db.collection(COLLECTION_NAME)
      .add(orderData)

    // TODO: 发送订单通知给对方

    return {
      success: true,
      data: {
        _id: result._id,
        ...orderData
      }
    }
  } catch (err) {
    console.error('createOrder error:', err)
    return {
      success: false,
      message: err.errMsg || '创建订单失败'
    }
  }
}

/**
 * 获取订单列表
 */
exports.getOrderList = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { status, page = 1, pageSize = 15 } = event

  try {
    // 构建查询条件
    const whereConditions = [
      _.or([
        { creatorOpenId: OPENID },
        { partnerOpenId: OPENID }
      ])
    ]

    // 添加状态筛选
    if (status) {
      whereConditions.push({ status })
    }

    const skip = (page - 1) * pageSize
    const result = await db.collection(COLLECTION_NAME)
      .where(whereConditions)
      .orderBy('date', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    const total = result.data.length

    return {
      success: true,
      data: {
        list: result.data,
        total,
        hasMore: total >= pageSize
      }
    }
  } catch (err) {
    console.error('getOrderList error:', err)
    return {
      success: false,
      message: err.errMsg || '获取订单列表失败'
    }
  }
}

/**
 * 根据ID获取订单详情
 */
exports.getOrderById = async (event, context) => {
  const { _id } = event

  try {
    const result = await db.collection(COLLECTION_NAME).doc(_id).get()
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('getOrderById error:', err)
    return {
      success: false,
      message: err.errMsg || '获取订单详情失败'
    }
  }
}

/**
 * 更新订单状态
 */
exports.updateOrderStatus = async (event, context) => {
  const { _id, status } = event

  try {
    const updateData = { status }
    if (status === 'cancelled') {
      updateData.cancelTime = new Date()
    } else if (status === 'confirmed') {
      updateData.confirmTime = new Date()
    } else if (status === 'completed') {
      updateData.completeTime = new Date()
    }

    await db.collection(COLLECTION_NAME)
      .doc(_id)
      .update({
        data: updateData
      })

    return {
      success: true
    }
  } catch (err) {
    console.error('updateOrderStatus error:', err)
    return {
      success: false,
      message: err.errMsg || '更新订单状态失败'
    }
  }
}

/**
 * 确认订单
 */
exports.confirmOrder = async (event, context) => {
  const { _id } = event

  try {
    await db.collection(COLLECTION_NAME)
      .doc(_id)
      .update({
        data: {
          status: 'confirmed',
          confirmTime: new Date()
        }
      })

    // TODO: 发送确认通知给点餐人

    return {
      success: true
    }
  } catch (err) {
    console.error('confirmOrder error:', err)
    return {
      success: false,
      message: err.errMsg || '确认订单失败'
    }
  }
}

/**
 * 完成订单
 */
exports.completeOrder = async (event, context) => {
  const { _id } = event

  try {
    await db.collection(COLLECTION_NAME)
      .doc(_id)
      .update({
        data: {
          status: 'completed',
          completeTime: new Date()
        }
      })

    return {
      success: true
    }
  } catch (err) {
    console.error('completeOrder error:', err)
    return {
      success: false,
      message: err.errMsg || '完成订单失败'
    }
  }
}

/**
 * 取消订单
 */
exports.cancelOrder = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { _id } = event

  try {
    // 获取订单信息
    const order = await db.collection(COLLECTION_NAME).doc(_id).get()
    if (!order.data) {
      return {
        success: false,
        message: '订单不存在'
      }
    }

    // 检查权限：只有点餐人或双方已确认订单后可以取消
    if (order.data.status !== 'pending' && order.data.status !== 'confirmed') {
      return {
        success: false,
        message: '当前状态不可取消'
      }
    }

    // 退还积分
    await db.collection(USER_COLLECTION)
      .where({ _openid: order.data.creatorOpenId })
      .update({
        credit: _.inc(order.data.totalCredit)
      })

    // 更新订单状态
    await db.collection(COLLECTION_NAME)
      .doc(_id)
      .update({
        data: {
          status: 'cancelled',
          cancelTime: new Date(),
          cancelledBy: OPENID
        }
      })

    // TODO: 发送取消通知

    return {
      success: true,
      data: {
        message: '订单已取消，积分已退还'
      }
    }
  } catch (err) {
    console.error('cancelOrder error:', err)
    return {
      success: false,
      message: err.errMsg || '取消订单失败'
    }
  }
}

// 主入口
exports.main = async (event, context) => {
  const { action } = event

  switch (action) {
    case 'createOrder':
      return await exports.createOrder(event, context)
    case 'getOrderList':
      return await exports.getOrderList(event, context)
    case 'getOrderById':
      return await exports.getOrderById(event, context)
    case 'updateOrderStatus':
      return await exports.updateOrderStatus(event, context)
    case 'confirmOrder':
      return await exports.confirmOrder(event, context)
    case 'completeOrder':
      return await exports.completeOrder(event, context)
    case 'cancelOrder':
      return await exports.cancelOrder(event, context)
    default:
      return {
        success: false,
        message: '未知操作'
      }
  }
}
