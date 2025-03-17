const Wishlist = require('../../models/wishlistSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');

// Load Wishlist Page
const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const user = await User.findById(userId);
        const wishlist = await Wishlist.findOne({ userId }).populate('products.productId');

        res.render('wishlist', {
            user,
            wishlist,
        });
    } catch (error) {
        console.error("Error in loadWishlist:", error);
        res.status(500).send('There is an error');
    }
};

// Add to Wishlist
const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in to add to wishlist' });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
        } else {
            const productExists = wishlist.products.some(item => item.productId.toString() === productId);

            if (productExists) {
                return res.status(400).json({ success: false, message: 'Product already in wishlist' });
            }

            wishlist.products.push({ productId });
        }

        await wishlist.save();
        res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Remove from Wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please log in to remove from wishlist'
            });
        }

        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        );

        if (!updatedWishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product removed from wishlist successfully'
        });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while removing from wishlist'
        });
    }
};

// Check if Product is in Wishlist
const checkWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in to check wishlist' });
        }

        const wishlist = await Wishlist.findOne({ userId });
        const isInWishlist = wishlist && wishlist.products.some(item => item.productId.toString() === productId);

        res.json({ success: true, isInWishlist });
    } catch (error) {
        console.error('Error in checkWishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    checkWishlist,
};