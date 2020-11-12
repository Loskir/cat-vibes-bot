const Telegraf = require('telegraf')

const {connectMongoose} = require('./core/db')

const {token} = require('./config')

void (async () => {
  await connectMongoose()

  const bot = new Telegraf(token)

  bot.use(
    require('./middlewares/main'),
    require('./middlewares/start'),
  )

  bot.catch(console.error)

  await bot.launch()
  console.log(`@${bot.options.username} launched`)
})()
