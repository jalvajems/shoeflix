const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  expireOn: {
    type: Date,
    required: true,
  },
  offerPrice: {
    type: Number, 
    required: false,
    default: 0,
  },
  discountPercentage: {
    type: Number, 
    required: false,
    default: 0,
  },
  minimumPrice: {
    type: Number, 
    required: true,
  },
  maxUses: {
    type: Number,
    default: null, 
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  userIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;