// cloudfunctions/pairManager/index.js
const cloud = require('wx-server-sdk').cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

const COLLECTION_NAME = 'CoupleRelation'

/**
 * 生成配对码
 */
exports.generatePairCode = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = cloud.getWXContext()

  try {
    // 检查是否已绑定
    const existingPair = await db.collection(COLLECTION_NAME)
      .where(_.or([
        { openIdA: OPENID, status: 'active' },
        { openIdB: OPENID, status: 'active' }
      ]))
      .get()

    if (existingPair.length > 0) {
      return {
        success: false,
        message: '您已绑定情侣，请先解绑'
      }
    }

    // 生成6位数字配对码
    const pairCode = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, '0')
    const expireTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期

    // 保存配对码
    await db.collection(COLLECTION_NAME)
      .add({
        openIdA: OPENID,
        pairCode,
        pairCodeExpire: new Date(expireTime),
        status: 'pending', // pending 表示未绑定
        createdAt: new Date()
      })

    return {
      success: true,
      data: {
        pairCode,
        expireTime
      }
    }
  } catch (err) {
    console.error('generatePairCode error:', err)
    return {
      success: false,
      message: err.errMsg || '生成配对码失败'
    }
  }
}

/**
 * 绑定情侣
 */
exports.bindPair = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = cloud.getWXContext()
  const { pairCode } = event

  try {
    // 查找配对码
    const pairCodeRecord = await db.collection(COLLECTION_NAME)
      .where({
        pairCode: pairCode,
        status: 'pending',
        pairCodeExpire: _.gt(new Date()) // 未过期
      })
      .get()

    if (pairCodeRecord.length === 0) {
      return {
        success: false,
        message: '配对码不存在或已过期'
      }
    }

    const pair = pairCodeRecord[0]

    // 检查配对码的持有者是否是自己
    if (pair.openIdA === OPENID) {
      return {
        success: false,
        message: '不能与自己绑定'
      }
    }

    // 检查对方是否已经绑定
    const otherOpenId = pair.openIdA === OPENID ? pair.openIdB : pair.openIdA
    const existingPair = await db.collection(COLLECTION_NAME)
      .where({
        status: 'active',
        _.or: [
          { openIdA: otherOpenId },
          { openIdB: otherOpenId }
        ]
      })
      .get()

    if (existingPair.length > 0) {
      return {
        success: false,
        message: '对方已与其他用户绑定'
      }
    }

    // 建立绑定关系
    const bindTime = new Date()
    await db.collection(COLLECTION_NAME)
      .doc(pair._id)
      .update({
        data: {
          openIdB: OPENID,
          status: 'active',
          bindTime: bindTime,
          updatedAt: bindTime
        }
      })

    return {
      success: true,
      data: {
        partnerOpenId: otherOpenId,
        bindTime
      }
    }
  } catch (err) {
    console.error('bindPair error:', err)
    return {
      success: false,
      message: err.errMsg || '绑定失败'
    }
  }
}

/**
 * 解绑情侣
 */
exports.unbindPair = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = cloud.getWXContext()

  try {
    // 查找绑定关系
    const pair = await db.collection(COLLECTION_NAME)
      .where({
        status: 'active',
        _.or: [
          { openIdA: OPENID },
          { openIdB: OPENID }
        ]
      })
      .get()

    if (pair.length === 0) {
      return {
        success: false,
        message: '未找到绑定关系'
      }
    }

    const unbindTime = new Date()
    await db.collection(COLLECTION_NAME)
      .doc(pair[0]._id)
      .update({
        data: {
          status: 'unbinding',
          unbindTime: unbindTime,
          updatedAt: unbindTime
        }
      })

    // TODO: 发送解绑通知给对方

    return {
      success: true,
      data: {
        message: '已解除绑定'
      }
    }
  } catch (err) {
    console.error('unbindPair error:', err)
    return {
      success: false,
      message: err.errMsg || '解绑失败'
    }
  }
}

/**
 * 获取配对信息
 */
exports.getPairInfo = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = cloud.getWXContext()

  try {
    const pair = await db.collection(COLLECTION_NAME)
      .where({
        status: 'active',
        _.or: [
          { openIdA: OPENID },
          { openIdB: OPENID }
        ]
      })
      .get()

    if (pair.length === 0) {
      return {
        success: true,
        data: {
          status: null,
          partnerOpenId: null,
          bindTime: null
        }
      }
    }

    const p = pair[0]
    const isUserA = p.openIdA === OPENID
    const partnerOpenId = isUserA ? p.openIdB : p.openIdA

    return {
      success: true,
      data: {
        status: 'active',
        partnerOpenId,
        bindTime: p.bindTime
      }
    }
  } catch (err) {
    console.error('getPairInfo error:', err)
    return {
      success: false,
      message: err.errMsg || '获取配对信息失败'
    }
  }
}

// 主入口
exports.main = async (event, context) => {
  const { action } = event

  switch (action) {
    case 'generatePairCode':
      return await exports.generatePairCode(event, context)
    case 'bindPair':
      return await exports.bindPair(event, context)
    case 'unbindPair':
      return await exports.unbindPair(event, context)
    case 'getPairInfo':
      return await exports.getPairInfo(event, context)
    default:
      return {
        success: false,
        message: '未知操作'
      }
  }
}
