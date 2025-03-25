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

    const errors = [];

    if (!name || !name.trim()) {
      errors.push('Coupon code is required');
    } else if (name.length < 4 || name.length > 20) {
      errors.push('Coupon code must be between 4 and 20 characters');
    } else if (!/^[A-Z0-9-]+$/.test(name)) {
      errors.push('Coupon code can only contain uppercase letters, numbers, and hyphens');
    }

    // Check if the coupon exist aanao============
    const couponExist = await Coupon.findOne({ name: name.toUpperCase() });
    if (couponExist) {
      errors.push('Coupon code already exists');
    }

    // Discount validation==========
    const parsedOfferPrice = parseFloat(offerPrice) || 0;
    const parsedDiscountPercentage = parseFloat(discountPercentage) || 0;
    
    if (!parsedOfferPrice && !parsedDiscountPercentage) {
      errors.push('Either offer price or discount percentage must be provided');
    }
    if (parsedOfferPrice < 0 || parsedOfferPrice > 10000) {
      errors.push('Offer price must be between 0 and 10,000');
    }
    if (parsedDiscountPercentage < 0 || parsedDiscountPercentage > 100) {
      errors.push('Discount percentage must be between 0 and 100');
    }

    // Minimum Price validation======
    const parsedMinimumPrice = parseFloat(minimumPrice);
    if (!minimumPrice || isNaN(parsedMinimumPrice) || parsedMinimumPrice <= 0) {
      errors.push('Minimum purchase amount must be a positive number');
    } else if (parsedMinimumPrice > 100000) {
      errors.push('Minimum purchase amount cannot exceed 100,000');
    } else if (parsedOfferPrice >= parsedMinimumPrice && parsedOfferPrice > 0) {
      errors.push('Offer price must be less than minimum purchase amount');
    }

    // Expiry Date validation============
    if (!expireOn) {
      errors.push('Expiration date is required');
    } else {
      const expirationDate = new Date(expireOn);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(expirationDate) || expirationDate < today) {
        errors.push('Expiration date must be today or in the future');
      }
    }

    const parsedMaxUses = maxUses ? parseInt(maxUses) : null;
    if (parsedMaxUses !== null && (isNaN(parsedMaxUses) || parsedMaxUses < 1)) {
      errors.push('Max uses must be a positive number');
    }

    if (errors.length > 0) {
      return res.status(400).json({ status: false, message: errors.join('. '), errors });
    }

   
    const newCoupon = new Coupon({
      name: name.toUpperCase(),
      expireOn: new Date(expireOn),
      offerPrice: parsedOfferPrice,
      discountPercentage: parsedDiscountPercentage,
      minimumPrice: parsedMinimumPrice,
      maxUses: parsedMaxUses,
      isActive: true, 
      createdOn: new Date()
    });

    await newCoupon.save();
    res.status(200).json({ 
      status: true, 
      message: 'Coupon created successfully', 
      coupon: newCoupon 
    });
  } catch (error) {
    console.error('Error in createCoupon:', error);
    res.status(500).json({ 
      status: false, 
      message: 'Error creating coupon', 
      error: error.message 
    });
  }
};
const editCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { offerPrice, discountPercentage, minimumPrice, expireOn, maxUses, isActive } = req.body;

    const errors = [];

    // Discount validation
    const parsedOfferPrice = parseFloat(offerPrice) || 0;
    const parsedDiscountPercentage = parseFloat(discountPercentage) || 0;
    
    if (!parsedOfferPrice && !parsedDiscountPercentage) {
      errors.push('Either offer price or discount percentage must be provided');
    }
    if (parsedOfferPrice < 0 || parsedOfferPrice > 10000) {
      errors.push('Offer price must be between 0 and 10,000');
    }
    if (parsedDiscountPercentage < 0 || parsedDiscountPercentage > 100) {
      errors.push('Discount percentage must be between 0 and 100');
    }

    // Minimum Price validation
    const parsedMinimumPrice = parseFloat(minimumPrice);
    if (!minimumPrice || isNaN(parsedMinimumPrice) || parsedMinimumPrice <= 0) {
      errors.push('Minimum purchase amount must be a positive number');
    } else if (parsedMinimumPrice > 100000) {
      errors.push('Minimum purchase amount cannot exceed 100,000');
    } else if (parsedOfferPrice >= parsedMinimumPrice && parsedOfferPrice > 0) {
      errors.push('Offer price must be less than minimum purchase amount');
    }

    // Expiry Date validation
    if (!expireOn) {
      errors.push('Expiration date is required');
    } else {
      const expirationDate = new Date(expireOn);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(expirationDate) || expirationDate < today) {
        errors.push('Expiration date must be today or in the future');
      }
    }

    // Max Uses validation
    const parsedMaxUses = maxUses ? parseInt(maxUses) : null;
    if (parsedMaxUses !== null && (isNaN(parsedMaxUses) || parsedMaxUses < 1)) {
      errors.push('Max uses must be a positive number');
    }

    if (errors.length > 0) {
      return res.status(400).json({ status: false, message: errors.join('. '), errors });
    }

    const couponUpdate = await Coupon.findByIdAndUpdate(
      couponId,
      {
        offerPrice: parsedOfferPrice,
        discountPercentage: parsedDiscountPercentage,
        minimumPrice: parsedMinimumPrice,
        expireOn: new Date(expireOn),
        maxUses: parsedMaxUses,
        isActive: isActive === true || isActive === 'true', // Explicitly handle boolean
        updatedOn: new Date()
      },
      { new: true }
    );

    if (!couponUpdate) {
      return res.status(404).json({ status: false, message: 'Coupon not found' });
    }

    res.status(200).json({ 
      status: true, 
      message: 'Coupon updated successfully', 
      coupon: couponUpdate 
    });
  } catch (error) {
    console.error('Error in editCoupon:', error);
    res.status(500).json({ 
      status: false, 
      message: 'Error updating coupon', 
      error: error.message 
    });
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
    res.status(500).json({ 
      status: false, 
      message: 'Error deleting coupon', 
      error: error.message 
    });
  }
};

module.exports = { loadCoupon, createCoupon, editCoupon, deleteCoupon };