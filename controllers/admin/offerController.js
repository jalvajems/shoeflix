const Offer = require("../../models/offerSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const applyProductOffer = async (offer) => {
    const product = await Product.findById(offer.productId).populate("category");
    if (!product) return;

    const discount = calculateDiscount(offer, product.regularPrice);
    const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;

    const bestDiscount = Math.max(discount, categoryOffer);
    product.productOffer = discount;
    product.salePrice = product.regularPrice - bestDiscount;

    await product.save();
};

const applyCategoryOffer = async (offer) => {
    const category = await Category.findById(offer.categoryId);
    if (!category) return;

    const products = await Product.find({ category: offer.categoryId });
    const discount = calculateDiscount(offer, products[0]?.regularPrice || 0);

    for (const product of products) {
        const productDiscount = calculateDiscount(offer, product.regularPrice);
        const bestDiscount = Math.max(productDiscount, product.productOffer || 0);
        category.categoryOffer = discount;
        product.salePrice = product.regularPrice - bestDiscount;
        await product.save();
    }

    await category.save();
};

const resetProductOffer = async (offer) => {
    const product = await Product.findById(offer.productId).populate("category");
    if (!product) return;

    product.productOffer = 0;
    const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
    product.salePrice = product.regularPrice - categoryOffer;
    await product.save();
};

const resetCategoryOffer = async (offer) => {
    const category = await Category.findById(offer.categoryId);
    if (!category) return;

    const products = await Product.find({ category: offer.categoryId });
    for (const product of products) {
        const productOffer = product.productOffer || 0;
        product.salePrice = product.regularPrice - productOffer;
        await product.save();
    }

    category.categoryOffer = 0;
    await category.save();
};

const calculateDiscount = (offer, price) => {
    if (offer.discountType === "percentage") {
        return (price * offer.discountValue) / 100;
    }
    return offer.discountValue;
};

const loadOffer = async (req, res) => {
    try {
        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isListed: true });
        res.render("offer", { products, categories });
    } catch (error) {
        console.error("Error loading offer page:", error);
        res.status(500).render("error", { message: "Error loading offer page" });
    }
};

const offerList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit;

        const totalOffers = await Offer.countDocuments();

        const offers = await Offer.find()
            .populate("productId", "productName")
            .populate("categoryId", "name")
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalOffers / limit);

        res.render("offerList", {
            offers,
            currentPage: page,
            totalPages,
            limit,
            totalOffers
        });
    } catch (error) {
        console.error("Error fetching offers:", error);
        res.status(500).render("error", { message: "Error fetching offers" });
    }
};

const getOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.offerId)
            .populate("productId", "productName")
            .populate("categoryId", "name");
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }
        res.status(200).json({ success: true, offer });
    } catch (error) {
        console.error("Error fetching offer:", error);
        res.status(500).json({ success: false, message: "Error fetching offer" });
    }
};

const addOffer = async (req, res) => {
    try {
        const { name, type, discountType, discountValue, productId, categoryId, startDate, endDate } = req.body;

        if (!name || !type || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const offer = new Offer({
            name,
            type,
            discountType,
            discountValue: parseFloat(discountValue),
            productId: type === "product" ? productId : null,
            categoryId: type === "category" ? categoryId : null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: true
        });

        await offer.save();

        if (type === "product") {
            await applyProductOffer(offer);
        } else if (type === "category") {
            await applyCategoryOffer(offer);
        }

        res.status(200).json({ success: true, message: "Offer added successfully." });
    } catch (error) {
        console.error("Error adding offer:", error);
        res.status(500).json({ success: false, message: error.message || "Error adding offer" });
    }
};

const updateOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const { name, discountType, discountValue, startDate, endDate, status } = req.body;

        if (!name || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const parsedDiscountValue = parseFloat(discountValue);
        if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
            return res.status(400).json({ success: false, message: "Discount Value must be a positive number." });
        }

        if (discountType === "percentage" && parsedDiscountValue > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%." });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date().setHours(0, 0, 0, 0);

        if (start < today) {
            return res.status(400).json({ success: false, message: "Start Date cannot be in the past." });
        }

        if (end <= start) {
            return res.status(400).json({ success: false, message: "End Date must be after Start Date." });
        }

        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        if (offer.type === "product") {
            await resetProductOffer(offer);
        } else if (offer.type === "category") {
            await resetCategoryOffer(offer);
        }

        offer.name = name;
        offer.discountType = discountType;
        offer.discountValue = parsedDiscountValue;
        offer.startDate = start;
        offer.endDate = end;
        offer.status = status === "true";

        await offer.save();

        if (offer.status) {
            if (offer.type === "product") {
                await applyProductOffer(offer);
            } else if (offer.type === "category") {
                await applyCategoryOffer(offer);
            }
        }

        res.status(200).json({ success: true, message: "Offer updated successfully" });
    } catch (error) {
        console.error("Error updating offer:", error);
        res.status(500).json({ success: false, message: "Error updating offer" });
    }
};
const removeOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).render("error", { message: "Offer not found" });
        }

        if (offer.type === "product") {
            await resetProductOffer(offer);
        } else if (offer.type === "category") {
            await resetCategoryOffer(offer);
        }

        await Offer.findByIdAndDelete(offerId);
        res.redirect("/admin/offer-list");
    } catch (error) {
        console.error("Error removing offer:", error);
        res.status(500).render("error", { message: "Error removing offer" });
    }
};
const getCategoryProducts = async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const products = await Product.find({ category: categoryId }, 'regularPrice');
        if (!products || products.length === 0) {
            return res.status(404).json({ success: false, message: "No products found in this category" });
        }
        res.status(200).json({ success: true, products });
    } catch (error) {
        console.error("Error fetching category products:", error);
        res.status(500).json({ success: false, message: "Error fetching category products" });
    }
};

module.exports = {
    loadOffer,
    offerList,
    getOffer, 
    addOffer,
    updateOffer,
    removeOffer,
    getCategoryProducts
};