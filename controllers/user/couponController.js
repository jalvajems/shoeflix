const Coupon = require('../../models/couponSchema');
const Cart = require('../../models/cartSchema');

const getActiveCoupons = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const activeCoupons = await Coupon.find({
      isActive: true,
      expireOn: { $gt: new Date() },
      userIds: { $nin: [userId] },
      $or: [
        { maxUses: { $exists: false } },
        { $expr: { $gt: ['$maxUses', '$usedCount'] } }
      ]
    }).select('name offerPrice discountPercentage minimumPrice');

    res.status(200).json({ success: true, coupons: activeCoupons });
  } catch (error) {
    console.error('Error fetching active coupons:', error);
    res.status(500).json({ success: false, message: 'Error fetching coupons', error: error.message });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, orderTotal } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coupon = await Coupon.findOne({
      name: couponCode,
      isActive: true,
      expireOn: { $gt: new Date() },
    });

    if (!coupon) {
      const availableCoupons = await Coupon.find({
        isActive: true,
        expireOn: { $gt: new Date() },
        userIds: { $nin: [userId] },
      }).select('name offerPrice discountPercentage minimumPrice');
      return res.status(404).json({
        success: false,
        message: 'Coupon not found or expired',
        availableCoupons,
      });
    }

    if (coupon.userIds.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon',
      });
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has reached its maximum usage limit',
      });
    }

    if (orderTotal < coupon.minimumPrice) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimumPrice} required`,
      });
    }

    let discountAmount = 0;
    if (coupon.offerPrice > 0) {
      discountAmount = Math.min(coupon.offerPrice, orderTotal);
    } else if (coupon.discountPercentage > 0) {
      discountAmount = (orderTotal * coupon.discountPercentage) / 100;
      discountAmount = Math.min(discountAmount, orderTotal);
    }

    // Store coupon in session =========
    req.session.appliedCoupon = couponCode;

    const newTotal = orderTotal - discountAmount;

    res.json({
      success: true,
      newTotal,
      discountAmount,
      message: 'Coupon applied successfully!',
    });
  } catch (error) {
    console.error('Error in applyCoupon:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!req.session.appliedCoupon) {
      return res.status(400).json({ success: false, message: 'No coupon applied' });
    }

    delete req.session.appliedCoupon; 

    res.json({ success: true, message: 'Coupon removed successfully' });
  } catch (error) {
    console.error('Error in removeCoupon:', error);
    res.status(500).json({ success: false, message: 'Cannot remove the coupon' });
  }
};

module.exports = { getActiveCoupons, applyCoupon, removeCoupon };