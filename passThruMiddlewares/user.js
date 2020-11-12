const {Composer} = require('telegraf')

const Users = require('../models/users')

const composer = new Composer()

const middleware = async (ctx, next) => {
  let user
  try {
    user = await Users.findOne({user_id: ctx.from.id})
    let params = {
      user_id: ctx.from.id,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username,
      language_code: ctx.from.language_code,
      last_activity_at: new Date(),
      is_blocked: false,
    }

    if (!user) {
      // ctx.grafana.new_user.inc()

      ctx.state.is_new_user = true
      console.log(`New user: ${ctx.from.id} ${ctx.from.first_name}${ctx.from.last_name ? ' '+ctx.from.last_name : ''}${ctx.from.username ? ` (@${ctx.from.username})` : ''}`)

      user = await Users.create(params)
    } else {
      user = await Users.findOneAndUpdate({_id: user._id}, {$set: params}, {new: true})
    }
  } catch (error) {
    console.error('Error user', error)
  }
  ctx.user = user || {}
  return next()
}

composer.on(['message', 'callback_query'], Composer.optional(
  (ctx) => ctx.chat && ctx.chat.type === 'private',
  middleware,
))

module.exports = composer
