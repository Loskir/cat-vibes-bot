const mongoose = require('mongoose')

const {setupUpdatedAt} = require('../functions/mongoose')

const users = new mongoose.Schema({
  user_id: {
    type: Number,
    unique: true,
  },

  username: String,
  first_name: String,
  last_name: String,
  language_code: String,

  is_blocked: {
    type: Boolean,
    default: false
  },

  last_activity_at: Date,
  created_at: {
    type: Date,
    default: () => new Date(),
  },
  updated_at: Date,
})
setupUpdatedAt(users)

module.exports = mongoose.model('users', users)
