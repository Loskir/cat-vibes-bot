const mongoose = require('mongoose')

const config = require('../config')

const connectMongoose = () => {
  return mongoose.connect(config.mongo, {
    useUnifiedTopology: true,
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: false,
  })
}

module.exports = {
  connectMongoose,
}
