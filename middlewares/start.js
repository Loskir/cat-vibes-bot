const {Composer} = require('telegraf')

const composer = new Composer()

let cachedGifFileId = 'CgACAgIAAxkDAAMrX6Zf-FXqaeBHxDRujsV5pTsunFwAAggHAALOGDFJW5soh67QEKkeBA'

composer.start((ctx) => {
  const caption = `Send me the BPM of a track and I'll make this cat vibe at your frequency!
    
By @Loskir
My channel – @Loskirs
Bot sources — <a href="https://github.com/Loskir/cat-vibes-bot">github.com/Loskir/cat-vibes-bot</a> 😉`
  const extra = {caption, parse_mode: 'HTML'}
  return ctx.telegram.sendAnimation(ctx.from.id, cachedGifFileId, extra)
    .catch(() => {
      console.warn(`failed to send gif`)
      return ctx.telegram.sendAnimation(ctx.from.id, {source: './cat.mp4'}, extra)
        .then((message) => {
          cachedGifFileId = message.animation.file_id
        })
    })
})

module.exports = composer