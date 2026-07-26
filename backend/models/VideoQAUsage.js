const mongoose = require("mongoose")

const videoQAUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    premiumQuestionsUsed: {
      type: Number,
      default: 0,
      max: 2,
    },
    standardQuestionsUsed: {
      type: Number,
      default: 0,
      max: 3,
    },
    imagesUploadedCount: {
      type: Number,
      default: 0,
      max: 2,
    },
    resetAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Composite index for efficient daily usage lookup
videoQAUsageSchema.index({ userId: 1, date: 1 }, { unique: true })

// Static method to get or create today's usage record
videoQAUsageSchema.statics.getTodayUsage = async function (userId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let usage = await this.findOne({
    userId,
    date: today,
  })

  if (!usage) {
    usage = await this.create({
      userId,
      date: today,
      resetAt: tomorrow,
      premiumQuestionsUsed: 0,
      standardQuestionsUsed: 0,
      imagesUploadedCount: 0,
    })
  }

  return usage
}

// Static method to check if user can ask a question
videoQAUsageSchema.statics.canAskQuestion = async function (userId, questionType) {
  const usage = await this.getTodayUsage(userId)

  if (questionType === "premium") {
    return usage.premiumQuestionsUsed < 2
  } else if (questionType === "standard") {
    return usage.standardQuestionsUsed < 3
  }

  return false
}

// Static method to check if user can upload images
videoQAUsageSchema.statics.canUploadImage = async function (userId) {
  const usage = await this.getTodayUsage(userId)
  return usage.imagesUploadedCount < 2
}

// Static method to increment usage
videoQAUsageSchema.statics.incrementUsage = async function (userId, type, count = 1) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const updateField =
    type === "premium"
      ? "premiumQuestionsUsed"
      : type === "standard"
        ? "standardQuestionsUsed"
        : "imagesUploadedCount"

  return await this.findOneAndUpdate(
    { userId, date: today },
    { $inc: { [updateField]: count } },
    { new: true, upsert: true }
  )
}

module.exports = mongoose.model("VideoQAUsage", videoQAUsageSchema)
