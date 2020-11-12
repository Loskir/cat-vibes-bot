const axios = require('axios')
const querystring = require('querystring')

const config = require('../config')

let accessToken
let tokenExpiresAt = 0

const getBasicAuthorization = () => `Basic ${Buffer.from(`${config.spotify_client_id}:${config.spotify_client_secret}`).toString('base64')}`
const getAuthorization = () => `Bearer ${accessToken}`

const refreshToken = async () => {
  console.log('updating token')
  const result = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
    grant_type: 'refresh_token',
    refresh_token: config.spotify_refresh_token
  }), {
    headers: {
      Authorization: getBasicAuthorization()
    }
  }).then((r) => r.data)
  console.log('Refreshed token')
  accessToken = result.access_token
  tokenExpiresAt = Date.now() + result.expires_in * 1000
}

const getTrack = async (id) => {
  console.log(`getting track ${id}`)
  if (tokenExpiresAt - Date.now() < 60000) {
    await refreshToken()
  }
  const result = await axios.get(`https://api.spotify.com/v1/audio-analysis/${id}`, {
    headers: {
      Authorization: getAuthorization()
    }
  })
  return result.data
}

module.exports = {
  getTrack,
}
