const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Offer = require("../../models/offerSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.params.id;

        if (!productId) {
            return res.redirect("/pageNotFound");
        }

        const product = await Product.findById(productId).populate("category");
        if (!product) {
            return res.redirect("/pageNotFound");
        }

        const findCategory = product.category;

        // Fetch active offers for the product and its category
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

        // Calculate the best offer
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

        // Fetch related products with ratings (if available in schema)
        const relatedProduct = await Product.find({
            category: findCategory,
            _id: { $ne: productId }
        })
            .sort({ createdAt: -1 })
            .limit(4)
            .select("productName productImage salePrice regularPrice averageRating ratingCount");
console.log("related products========",relatedProduct);

        return res.render("product-details", {
            user: userData,
            product: product,
            category: findCategory,
            relatedProduct,
            bestOffer: bestOffer ? { name: bestOfferName, discount: bestDiscount } : null
        });
    } catch (error) {
        console.log("Error for fetching product details", error);
        return res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetails
};