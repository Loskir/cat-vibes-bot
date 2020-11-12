const {Extra, Markup} = require('telegraf')
const pLimit = require('p-limit')

const {spawn} = require('child_process')
const fs = require('fs')

const {
  hrt,
  fmtPrc,
} = require('./timings')

const Caches = require('../models/caches')

const limit = pLimit(1)

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

const process = async (ctx, bpm) => {
  const cache = await Caches.findOne({bpm})
  if (cache) {
    console.log(`${bpm}: sent from cache`)
    return ctx.telegram.sendAnimation(
      ctx.from.id,
      cache.file_id,
      Extra.markup(Markup.inlineKeyboard([[Markup.switchToChatButton('Share', bpm.toString())]])),
    )
  }

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
}

module.exports = {
  makeVideo,
  process,
}
