const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require("../../models/productSchema");


const getCheckoutPage = async (req, res) => {
    try {
        // Check if user is logged in
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Get user's cart with populated products
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName salePrice regularPrice productImage status variants productOffer isBlocked'
        });

        // Check if cart exists and has items
        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart?error=empty_cart');
        }

        // Check stock availability and product status for each item
        let isStockSufficient = true;
        const stockCheckDetails = cart.items.map((item) => {
            // Check if product exists and is not blocked
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

            // Find stock for the selected size
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

        console.log("Stock check details:", stockCheckDetails);

        // If stock is insufficient, redirect to cart with error
        if (!isStockSufficient) {
            console.log("Insufficient stock for one or more items in your cart.");
            return res.redirect('/cart?error=insufficient_stock');
        }

        // Calculate subtotal considering product offers
        const subtotal = cart.items.reduce((total, item) => {
            if (item.productId) {
                // Apply product offer if exists
                const offerPrice = item.productId.productOffer > 0 
                    ? item.price - (item.price * item.productId.productOffer / 100)
                    : item.price;
                return total + (offerPrice * item.quantity);
            }
            return total;
        }, 0);

        // Get user's addresses
        const userAddress = await Address.findOne({ userId });

        // Get available coupons (uncomment and adjust as needed)
        // const validCoupons = await Coupon.find({
        //     isActive: true,
        //     expireOn: { $gt: new Date() },
        //     createdOn: { $lt: new Date() },
        //     $or: [
        //         { userId: { $eq: [] } },
        //         { userId: { $nin: [userId] } }
        //     ]
        // })
        // .sort({ createdOn: -1 })
        // .select('name offerPrice minimumPrice');

        // Render checkout page
        return res.render('checkout', {
            cart,
            addresses: userAddress ? userAddress.addresses : [],
            user,
            subtotal,
            walletBalance: user.wallet || 0,
            validCoupons: [], // Add this to avoid undefined error in template
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

        // Validate required fields
        if (!addressId || !paymentMethod) {
            return res.status(400).json({ 
                success: false, 
                message: 'Address and payment method are required' 
            });
        }

        // Get cart and validate
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

        // Re-check stock availability and product status
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

        // Get selected address
        const userAddress = await Address.findOne({ userId });
        const selectedAddress = userAddress.addresses.id(addressId);
        if (!selectedAddress) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid address selected' 
            });
        }

        // Calculate totals considering product offers
        let subtotal = cart.items.reduce((total, item) => {
            const offerPrice = item.productId.productOffer > 0 
                ? item.price - (item.price * item.productId.productOffer / 100)
                : item.price;
            return total + (offerPrice * item.quantity);
        }, 0);

        // Apply coupon if provided
        let discount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode });
            if (coupon && coupon.isActive && coupon.expireOn > new Date() && subtotal >= coupon.minimumPrice) {
                discount = coupon.offerPrice;
                subtotal -= discount;
            }
        }

        // Handle wallet payment if selected
        if (useWallet) {
            const user = await User.findById(userId);
            if (user.wallet < subtotal) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }
        }

        // Here you would typically:
        // 1. Create an order
        // 2. Update product stock
        // 3. Clear cart
        // 4. Handle payment
        // 5. Update wallet if used
        // 6. Send confirmation email

        // For now, let's just return success
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

module.exports = {
    getCheckoutPage,
    checkout
};