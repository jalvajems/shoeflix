const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require("../../models/productSchema");

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName salePrice regularPrice productImage status variants productOffer isBlocked'
        });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart?error=empty_cart');
        }

        let isStockSufficient = true;
        const stockCheckDetails = cart.items.map((item) => {
            if (!item.productId || item.productId.isBlocked || item.productId.status !== 'Available') {
                isStockSufficient = false;
                return {
                    productName: item.productId?.productName || 'Unknown',
                    size: item.size,
                    quantityOrdered: item.quantity,
                    stockAvailable: 0,
                    stockSufficient: false,
                    error: 'Product not available'
                };
            }

            const variant = item.productId.variants.find(
                (variant) => variant.size === item.size
            );

            const productStock = variant ? variant.quantity : 0;

            if (item.quantity > productStock) {
                isStockSufficient = false;
            }

            return {
                productName: item.productId.productName,
                size: item.size,
                quantityOrdered: item.quantity,
                stockAvailable: productStock,
                stockSufficient: item.quantity <= productStock
            };
        });

        if (!isStockSufficient) {
            console.log("Insufficient stock for one or more items in your cart.");
            return res.redirect('/cart?error=insufficient_stock');
        }

        const subtotal = cart.items.reduce((total, item) => {
            if (item.productId) {
                const offerPrice = item.productId.productOffer > 0
                    ? item.price - (item.price * item.productId.productOffer / 100)
                    : item.price;
                return total + (offerPrice * item.quantity);
            }
            return total;
        }, 0);

        const userAddress = await Address.findOne({ userId });

        return res.render('checkout', {
            cart,
            addresses: userAddress ? userAddress.addresses : [],
            user,
            subtotal,
            walletBalance: user.wallet || 0,
            validCoupons: [], // You can populate this with actual coupons if you have a Coupon model
            error: null
        });

    } catch (error) {
        console.error('Checkout page error:', error);
        return res.status(500).render('pageNotFound', {
            message: 'Error loading checkout page',
            error: error.message
        });
    }
};

const checkout = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to continue' });
        }

        const {
            addressId,
            paymentMethod,
            couponCode,
            useWallet = false
        } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Address and payment method are required'
            });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName salePrice regularPrice variants productOffer isBlocked status'
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        for (const item of cart.items) {
            if (!item.productId || item.productId.isBlocked || item.productId.status !== 'Available') {
                return res.status(400).json({
                    success: false,
                    message: `Product ${item.productId?.productName || ''} is not available`
                });
            }

            const variant = item.productId.variants.find(
                (variant) => variant.size === item.size
            );

            const productStock = variant ? variant.quantity : 0;

            if (item.quantity > productStock) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${item.productId.productName}`
                });
            }
        }

        const userAddress = await Address.findOne({ userId });
        const selectedAddress = userAddress.addresses.id(addressId);
        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address selected'
            });
        }

        let subtotal = cart.items.reduce((total, item) => {
            const offerPrice = item.productId.productOffer > 0
                ? item.price - (item.price * item.productId.productOffer / 100)
                : item.price;
            return total + (offerPrice * item.quantity);
        }, 0);

        let discount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode });
            if (coupon && coupon.isActive && coupon.expireOn > new Date() && subtotal >= coupon.minimumPrice) {
                discount = coupon.offerPrice;
                subtotal -= discount;
            }
        }

        if (useWallet) {
            const user = await User.findById(userId);
            if (user.wallet < subtotal) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderDetails: {
                subtotal,
                discount,
                total: subtotal,
                paymentMethod,
                address: selectedAddress
            }
        });

    } catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing checkout',
            error: error.message
        });
    }
};

// Add Address Controller
const addAddress = async (req, res) => {
    try {
        console.log();
        
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add an address' });
        }

        const {
            addressType,
            name,
            landMark,
            city,
            state,
            pincode,
            phone,
            altPhone
        } = req.body;

        // Validate required fields
        if (!addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled' });
        }

        // Validate phone number (basic validation for 10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone) || !phoneRegex.test(altPhone)) {
            return res.status(400).json({ success: false, message: 'Phone numbers must be 10 digits' });
        }

        // Validate pincode (basic validation for 6 digits)
        const pincodeRegex = /^\d{6}$/;
        if (!pincodeRegex.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Pincode must be 6 digits' });
        }
        
        // Create new address object
        const newAddress = {
            addressType,
            name,
            landMark,
            city,
            state,
            pincode,
            phone,
            altPhone
        };
        console.log(newAddress); 

        // Find or create user's address document
        let userAddress = await Address.findOne({ userId });
        console.log("userAddress=======",userAddress)
        if (!userAddress) {
            userAddress = new Address({
                userId,
                addresses: [newAddress]
            });
        } else {
            userAddress.addresses.push(newAddress);
        }
        console.log("useraddress===== after else",userAddress)

        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address added successfully',
            address: newAddress
        });

    } catch (error) {
        console.error('Error adding address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding address',
            error: error.message
        });
    }
};

// Update Address Controller
const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to update an address' });
        }

        const {
            _id,
            addressType,
            name,
            landMark,
            city,
            state,
            pincode,
            phone,
            altPhone
        } = req.body;

        // Validate required fields
        if (!_id || !addressType || !name || !city || !landMark || !state || !pincode || !phone || !altPhone) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled' });
        }

        // Validate phone number (basic validation for 10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone) || !phoneRegex.test(altPhone)) {
            return res.status(400).json({ success: false, message: 'Phone numbers must be 10 digits' });
        }

        // Validate pincode (basic validation for 6 digits)
        const pincodeRegex = /^\d{6}$/;
        if (!pincodeRegex.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Pincode must be 6 digits' });
        }

        // Find user's address document
        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(404).json({ success: false, message: 'No addresses found for user' });
        }

        // Find the address to update
        const addressToUpdate = userAddress.addresses.id(_id);
        if (!addressToUpdate) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        // Update address fields
        addressToUpdate.addressType = addressType;
        addressToUpdate.name = name;
        addressToUpdate.landMark = landMark;
        addressToUpdate.city = city;
        addressToUpdate.state = state;
        addressToUpdate.pincode = pincode;
        addressToUpdate.phone = phone;
        addressToUpdate.altPhone = altPhone;

        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            address: addressToUpdate
        });

    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating address',
            error: error.message
        });
    }
};

module.exports = {
    getCheckoutPage,
    checkout,
    addAddress,
    updateAddress
};