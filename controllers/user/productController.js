const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Offer = require("../../models/offerSchema");
const Review = require("../../models/reviewSchema");
const Order = require("../../models/orderSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.params.id;

        if (!productId) {
            return res.redirect("/pageNotFound");
        }

        let product = await Product.findById(productId).populate("category");
        if (!product) {
            return res.redirect("/pageNotFound");
        }

        const findCategory = product.category;

        const reviews = await Review.find({ productId }).populate("userId", "name");

        let hasPurchased = false;
        if (userId) {
            const orders = await Order.find({
                userId,
                status: "Delivered", 
                "orderItems.product": productId 
            });
            hasPurchased = orders.length > 0;
        }

        const currentDate = new Date();
        const productOffers = await Offer.find({
            type: "product",
            productId: product._id,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
            status: true
        });

        const categoryOffers = await Offer.find({
            type: "category",
            categoryId: findCategory._id,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
            status: true
        });

        let bestOffer = null;
        let bestDiscount = 0;
        let bestOfferName = "";

        for (const offer of productOffers) {
            let discount;
            if (offer.discountType === "percentage") {
                discount = (product.regularPrice * offer.discountValue) / 100;
            } else {
                discount = offer.discountValue;
            }
            if (discount > bestDiscount) {
                bestDiscount = discount;
                bestOffer = offer;
                bestOfferName = offer.name;
            }
        }

        for (const offer of categoryOffers) {
            let discount;
            if (offer.discountType === "percentage") {
                discount = (product.regularPrice * offer.discountValue) / 100;
            } else {
                discount = offer.discountValue;
            }
            if (discount > bestDiscount) {
                bestDiscount = discount;
                bestOffer = offer;
                bestOfferName = offer.name;
            }
        }
         let applied =product.regularPrice-bestDiscount
        console.log("offer d details",bestOffer,bestDiscount);
        product=await Product.findByIdAndUpdate({_id:productId},{$set:{salePrice:applied}})
        // console.log("product details===================",product);
        const relatedProduct = await Product.find({
            category: findCategory,
            _id: { $ne: productId }
        })
            .sort({ createdAt: -1 })
            .limit(4)
            .select("productName productImage salePrice regularPrice averageRating ratingCount");

        return res.render("product-details", {
            user: userData,
            product: product,
            category: findCategory,
            relatedProduct,
            reviews,
            hasPurchased, 
            bestOffer: bestOffer ? { name: bestOfferName, discount: bestDiscount } : null
        });
    } catch (error) {
        console.log("Error for fetching product details", error);
        return res.redirect("/pageNotFound");
    }
};

const submitReview = async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to submit a review." });
        }

        const orders = await Order.find({
            userId,
            status: "Delivered",
            "orderItems.product": productId
        });
        if (orders.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You can only review products you have purchased and received."
            });
        }

  const existingReview = await Review.findOne({ productId, userId });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "You have already reviewed this product."
            });
        }

        const review = new Review({
            productId,
            userId,
            rating,
            comment
        });
        await review.save();

        // Update product's average rating and rating count
        const reviews = await Review.find({ productId });
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await Product.findByIdAndUpdate(productId, {
            averageRating: avgRating,
            ratingCount: reviews.length
        });

        res.status(200).json({ success: true, message: "Review submitted successfully!" });
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ success: false, message: "Failed to submit review." });
    }
};

module.exports = {
    productDetails,
    submitReview
};
