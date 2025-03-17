const Coupon = require('../../models/couponSchema');

const loadCoupon = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect('/admin/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find()
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const count = await Coupon.countDocuments();
    const totalPages = Math.ceil(count / limit);

    res.render('coupon', { coupons, totalPages, currentPage: page });
  } catch (error) {
    console.error('Error in loadCoupon:', error);
    res.status(500).json({ success: false, message: 'Can’t access coupon page', error: error.message });
  }
};

const createCoupon = async (req, res) => {
  try {
    const { name, offerPrice, discountPercentage, minimumPrice, expireOn, maxUses } = req.body;

    if (!name || !minimumPrice || !expireOn || (!offerPrice && !discountPercentage)) {
      return res.status(400).json({ status: false, message: 'All required fields must be provided' });
    }

    const couponExist = await Coupon.findOne({ name });
    if (couponExist) {
      return res.status(400).json({ status: false, message: 'Coupon already exists' });
    }

    const expirationDate = new Date(expireOn);
    if (isNaN(expirationDate) || expirationDate <= new Date()) {
      return res.status(400).json({ status: false, message: 'Expiration date must be in the future' });
    }

    const parsedOfferPrice = parseFloat(offerPrice) || 0;
    const parsedDiscountPercentage = parseFloat(discountPercentage) || 0;
    if (parsedOfferPrice <= 0 && parsedDiscountPercentage <= 0) {
      return res.status(400).json({ status: false, message: 'Offer price or discount percentage must be positive' });
    }
    if (parsedOfferPrice > 10000 || parsedDiscountPercentage > 100) {
      return res.status(400).json({ status: false, message: 'Invalid discount value' });
    }

    const parsedMinimumPrice = parseFloat(minimumPrice);
    if (isNaN(parsedMinimumPrice) || parsedMinimumPrice <= 0 || parsedMinimumPrice > 100000) {
      return res.status(400).json({ status: false, message: 'Invalid minimum amount' });
    }

    if (parsedOfferPrice >= parsedMinimumPrice && parsedOfferPrice > 0) {
      return res.status(400).json({ status: false, message: 'Offer price must be less than minimum price' });
    }

    const newCoupon = new Coupon({
      name: name.toUpperCase(),
      expireOn: expirationDate,
      offerPrice: parsedOfferPrice,
      discountPercentage: parsedDiscountPercentage,
      minimumPrice: parsedMinimumPrice,
      maxUses: parseInt(maxUses) || null,
    });

    await newCoupon.save();
    res.status(200).json({ status: true, message: 'Coupon created successfully', coupon: newCoupon });
  } catch (error) {
    res.status(500).json({ status: false, message: 'Error in creating the coupon', error: error.message });
  }
};

const editCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { offerPrice, discountPercentage, minimumPrice, expireOn, maxUses, isActive } = req.body;

    if (!offerPrice && !discountPercentage) {
      return res.status(400).json({ status: false, message: 'Offer price or discount percentage is required' });
    }

    const parsedOfferPrice = parseFloat(offerPrice) || 0;
    const parsedDiscountPercentage = parseFloat(discountPercentage) || 0;
    if (parsedOfferPrice > 10000 || parsedDiscountPercentage > 100) {
      return res.status(400).json({ status: false, message: 'Invalid discount value' });
    }

    const parsedMinimumPrice = parseFloat(minimumPrice);
    if (isNaN(parsedMinimumPrice) || parsedMinimumPrice <= 0 || parsedMinimumPrice > 100000) {
      return res.status(400).json({ status: false, message: 'Invalid minimum amount' });
    }

    if (parsedOfferPrice >= parsedMinimumPrice && parsedOfferPrice > 0) {
      return res.status(400).json({ status: false, message: 'Offer price must be less than minimum price' });
    }

    const expirationDate = new Date(expireOn);
    if (isNaN(expirationDate) || expirationDate <= new Date()) {
      return res.status(400).json({ status: false, message: 'Expiration date must be in the future' });
    }
    console.log('Received isActive:', req.body.isActive);
    const couponUpdate = await Coupon.findByIdAndUpdate(
      couponId,
      {
        offerPrice: parsedOfferPrice,
        discountPercentage: parsedDiscountPercentage,
        minimumPrice: parsedMinimumPrice,
        expireOn: expirationDate,
        maxUses: parseInt(maxUses) || null,
        isActive: isActive === 'true',
      },
      { new: true }
    );

    if (!couponUpdate) {
      return res.status(404).json({ status: false, message: 'Coupon not found' });
    }

    res.status(200).json({ status: true, message: 'Coupon updated successfully', coupon: couponUpdate });
  } catch (error) {
    console.error('Error in editCoupon:', error);
    res.status(500).json({ status: false, message: 'Error updating coupon', error: error.message });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findByIdAndDelete(couponId);
    if (!coupon) {
      return res.status(404).json({ status: false, message: 'Coupon not found' });
    }
    res.status(200).json({ status: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error in deleteCoupon:', error);
    res.status(500).json({ status: false, message: 'Error deleting coupon', error: error.message });
  }
};

module.exports = { loadCoupon, createCoupon, editCoupon, deleteCoupon };