const {Composer, Extra, Markup} = require('telegraf')
const rateLimit = require('telegraf-ratelimit')
const axios = require('axios')

const Caches = require('../models/caches')

const {process} = require('../functions/main')
const {getTrack} = require('../functions/spotify')

const songLinkRegex = /^https:\/\/song\.link/i

const filterBPM = async (ctx, next) => {
  const bpm = Number(ctx.match[1])
  if (bpm > 600) {
    return ctx.reply('BPM is too big. 60 ≤ BPM ≤ 600')
  }
  if (bpm < 60) {
    return ctx.reply('BPM is too small. 60 ≤ BPM ≤ 600')
  }
  ctx.state.bpm = bpm
  return next()
}

const composer = new Composer()

composer.on('message', async (ctx, next) => {
  const entities = ctx.message.entities || ctx.message.caption_entities
  if (!entities) {
    return next()
  }

  const songLinkURL = (() => {
    for (const entity of entities) {
      if (entity.type === 'text_link') {
        const match = entity.url.match(songLinkRegex)
        if (match) return entity.url
      }
      if (entity.type === 'url') {
        const text = ctx.message.text.substr(entity.offset, entity.length)
        const match = text.match(songLinkRegex)
        if (match) return text
      }
    }
    return false
  })()
  if (!songLinkURL) {
    return next()
  }
  await ctx.reply('Found! Getting BPM')
  console.log(`Found song.link: ${songLinkURL}`)

  axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(songLinkURL)}&platform=spotify`)
    .catch((e) => {
      console.error(e)
      return ctx.reply('Error getting BPM :( [song.link]')
    })
    .then(({data}) => {
      const spotifyData = data.entitiesByUniqueId[data.entityUniqueId]
      const spotifyId = spotifyData.id
      console.log(`got spotify id: ${spotifyId}`)
      return spotifyId
    })
    .then((spotifyId) => getTrack(spotifyId))
    .catch((e) => {
      console.error(e)
      return ctx.reply('Error getting BPM :( [spotify]')
    })
    .then((result) => process(ctx, result.track.tempo))
})
composer.on('audio', (ctx) => ctx.reply('Only songs with song.link are supported. Use @nowplaybot or similar'))
composer.hears(
  /(\d+)/,
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
  (ctx) => process(ctx, ctx.state.bpm),
)
composer.on('inline_query', async (ctx) => {
  const {query} = ctx.inlineQuery

  const match = query.match(/(\d+(?:\.\d+)?)/)
  if (match) {
    const bpm = parseFloat(match[1])
    if (bpm > 600) {
      return ctx.answerInlineQuery([], {
        cache_time: 0,
        switch_pm_text: 'BPM is too big. 60 ≤ BPM ≤ 600',
        switch_pm_parameter: 'a',
      })
    }
    if (bpm < 60) {
      return ctx.answerInlineQuery([], {
        cache_time: 0,
        switch_pm_text: 'BPM is too small. 60 ≤ BPM ≤ 600',
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
      switch_pm_text: `There is no cached gif for ${Math.round(bpm)} BPM. Click here to generate one`,
      switch_pm_parameter: Math.round(bpm).toString(),
    })
  }

  return ctx.answerInlineQuery([], {switch_pm_text: 'Type the BPM (60 ≤ BPM ≤ 600)', switch_pm_parameter: 'a'})
})

module.exports = composer