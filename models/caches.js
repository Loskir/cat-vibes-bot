const mongoose = require('mongoose')

// indexes: {bpm: 1}

const schema = new mongoose.Schema({
  bpm: Number,
  file_id: String,
})

module.exports = mongoose.model('caches', schema)
