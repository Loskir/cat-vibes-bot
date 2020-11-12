const setupUpdatedAt = (schema) => {
  schema.pre('save', function (next) {
    this.updated_at = new Date()
    return next()
  })
  schema.pre('updateOne', function () {
    this.set({updated_at: new Date()})
  })
  schema.pre('findOneAndUpdate', function () {
    this.set({updated_at: new Date()})
  })
}

module.exports = {
  setupUpdatedAt,
}
