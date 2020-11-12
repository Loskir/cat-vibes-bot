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

  let songLinkResult
  try {
    songLinkResult = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(songLinkURL)}&platform=spotify`)
  } catch(e) {
    console.error(e)
    return ctx.reply('Error getting BPM :( [song.link]')
  }
  let spotifyResult
  try {
    const {data} = songLinkResult
    const spotifyData = data.entitiesByUniqueId[data.entityUniqueId]
    const spotifyId = spotifyData.id
    console.log(`got spotify id: ${spotifyId}`)
    spotifyResult = await getTrack(spotifyId)
  } catch (e) {
    console.warn(e)
    return ctx.reply('Error getting BPM :( [spotify]')
  }

  if (!spotifyResult || !spotifyResult.track || !spotifyResult.track.tempo) {
    console.warn(spotifyResult)
    return ctx.reply('Error getting BPM :( [spotify]')
  }
  return process(ctx, spotifyResult.track.tempo)
})
composer.on('audio', (ctx) => ctx.reply('Only songs with song.link are supported. Use @nowplaybot or similar'))
composer.hears(
  /(\d+)/,
  filterBPM,
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