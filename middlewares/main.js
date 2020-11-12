const {Composer, Extra, Markup} = require('telegraf')
const rateLimit = require('telegraf-ratelimit')
const pLimit = require('p-limit')

const fs = require('fs')
const {spawn} = require('child_process')

const Caches = require('../models/caches')

const {
  hrt,
  fmtPrc,
} = require('../functions/timings')

const limit = pLimit(1)

const bpmRegex = /(\d+)/

const makeVideo = (bpm, outPath) => new Promise(async (resolve) => {
  console.log(`${bpm}: starting ffmpeg`)
  const ffmpegStart = hrt()

  // let newFPS = bpm / 123 * 29.97
  // if (newFPS <= 29.97) {
  //   newFPS = 29.97
  // } else {
  //   newFPS = 29.97 * 2
  // }

  const newFPS = 29.97

  const ls = spawn('ffmpeg', [
    '-y',
    '-i', 'cat.mp4',
    '-filter:v', `setpts=${123 / bpm}*PTS`,
    '-r', newFPS,
    outPath,
  ])

  ls.once('close', (code) => {
    console.log(`${bpm}: ffmpeg finished with code ${code} in ${fmtPrc(hrt(ffmpegStart))}ms`)
    resolve()
  })
})

const filterBPM = async (ctx, next) => {
  const bpm = Number(ctx.match[1])
  if (bpm > 600) {
    return ctx.reply('BPM is too big. 10 ≤ BPM ≤ 600')
  }
  if (bpm < 10) {
    return ctx.reply('BPM is too small. 10 ≤ BPM ≤ 600')
  }
  ctx.state.bpm = bpm
  return next()
}

const composer = new Composer()

composer.hears(
  bpmRegex,
  filterBPM,
  async (ctx, next) => {
    const {bpm} = ctx.state
    const cache = await Caches.findOne({bpm})
    if (cache) {
      console.log(`${bpm}: sent from cache`)
      return ctx.telegram.sendAnimation(
        ctx.from.id,
        cache.file_id,
        Extra.markup(Markup.inlineKeyboard([[Markup.switchToChatButton('Share', bpm.toString())]])),
      )
    }
    return next()
  },
  rateLimit({
    window: 5000,
    limit: 1,
    onLimitExceeded: (ctx) => {
      return ctx.reply(`Not so fast!`)
    },
  }),
  async (ctx) => {
    const {bpm} = ctx.state
    const tmpPath = `${bpm}_${Date.now()}.mp4`

    await ctx.reply(`Generating ${bpm} BPM...\nPlease wait for a few seconds!`).catch(console.warn)

    limit(async () => {
      const cache = await Caches.findOne({bpm})
      if (cache) {
        console.log(`re-check: ${bpm}: cache found`)
        return ctx.telegram.sendAnimation(
          ctx.from.id,
          cache.file_id,
          Extra.markup(Markup.inlineKeyboard([[Markup.switchToChatButton('Share', bpm.toString())]])),
        )
      }

      await makeVideo(bpm, tmpPath)

      if (!fs.existsSync(tmpPath)) {
        return ctx.reply('Error???')
      }

      return ctx.telegram.sendAnimation(
        ctx.from.id,
        {source: fs.createReadStream(tmpPath)},
        Extra.markup(Markup.inlineKeyboard([[Markup.switchToChatButton('Share', bpm.toString())]])),
      )
        .then((message) => {
          try {fs.unlinkSync(tmpPath)} catch (e) {}
          return Caches.findOneAndUpdate({bpm}, {bpm, file_id: message.animation.file_id}, {upsert: true})
        })
    })
  },
)
composer.on('inline_query', async (ctx) => {
  const {query} = ctx.inlineQuery

  const match = query.match(bpmRegex)
  if (match) {
    const bpm = Number(match[1])
    if (bpm > 600) {
      return ctx.answerInlineQuery([], {
        cache_time: 0,
        switch_pm_text: 'BPM is too big. 10 ≤ BPM ≤ 600',
        switch_pm_parameter: 'a',
      })
    }
    if (bpm < 10) {
      return ctx.answerInlineQuery([], {
        cache_time: 0,
        switch_pm_text: 'BPM is too small. 10 ≤ BPM ≤ 600',
        switch_pm_parameter: 'a',
      })
    }
    const cache = await Caches.findOne({bpm})
    if (cache) {
      console.log(`inline: ${bpm}: cache found`)
      return ctx.answerInlineQuery([
        {
          type: 'mpeg4_gif',
          mpeg4_file_id: cache.file_id,
          id: bpm.toString(),
        },
      ])
    }
    console.log(`inline: ${bpm}: cache not found`)
    return ctx.answerInlineQuery([], {
      cache_time: 0,
      switch_pm_text: 'There is no cached gif for that BPM. Click here to generate one',
      switch_pm_parameter: bpm.toString(),
    })
  }

  return ctx.answerInlineQuery([], {switch_pm_text: 'Type the BPM (10 ≤ BPM ≤ 600)', switch_pm_parameter: 'a'})
})

module.exports = composer