// cartController.js
const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

const checkCartQuantity = async (req, res) => {
    try {
        const { productId, size } = req.params;
        const userId = req.session.user;

        if (!userId) {
            return res.json({ status: false, message: "User not authenticated" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({ status: true, quantity: 0 });
        }

        const item = cart.items.find(
            (item) => item.productId.toString() === productId && item.size === size
        );
        const quantity = item ? item.quantity : 0;

        return res.json({ status: true, quantity });
    } catch (error) {
        console.error("Error checking cart quantity:", error);
        return res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const checkStock = async (req, res) => {
    try {
        const { productId, size } = req.params;
        const product = await Product.findById(productId);
        
        if (!product || product.isBlocked || product.status !== "Available") {
            return res.json({ status: false, availableStock: 0 });
        }

        const variant = product.variants.find((v) => v.size === size);
        if (!variant) {
            return res.json({ status: false, availableStock: 0 });
        }

        return res.json({ status: true, availableStock: variant.quantity });
    } catch (error) {
        console.error("Error checking stock:", error);
        return res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId: userId })
            .populate("items.productId", "productName salePrice productImage isBlocked status");

        if (!cart) {
            return res.render("cart", {
                user: await User.findById(userId),
                cart: [],
                totalPrice: 0
            });
        }

        const filteredItems = cart.items.filter(item =>
            item.productId && !item.productId.isBlocked && item.productId.status === "Available"
        );

        const sortedItems = filteredItems.sort((a, b) => b.addedOn - a.addedOn);

        const totalPrice = sortedItems.reduce((acc, item) => acc + item.totalPrice, 0);
console.log("sorted items",sortedItems);

        return res.render("cart", {
            user: await User.findById(userId),
            cart: sortedItems,
            totalPrice: totalPrice
        });
    } catch (error) {
        console.log("Error loading cart:", error);
        return res.redirect("/pageNotFound");
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, size, quantity } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.json({ status: false, message: "User not authenticated" });
        }

        const product = await Product.findById(productId);
        if (!product || product.isBlocked || product.status !== "Available") {
            return res.json({ status: false, message: "Product not available" });
        }

        const validSizes = ["IND-5", "IND-6", "IND-7", "IND-8"];
        if (!validSizes.includes(size)) {
            return res.json({ status: false, message: "Invalid size selected" });
        }

        const variant = product.variants.find((v) => v.size === size);
        if (!variant || variant.quantity < quantity) {
            return res.json({ status: false, message: "Insufficient stock" });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({
                userId,
                items: [{
                    productId,
                    quantity,
                    size,
                    price: product.salePrice,
                    totalPrice: product.salePrice * quantity,
                    addedOn: new Date()
                }],
            });
        } else {
            const existingItemIndex = cart.items.findIndex(
                (item) => item.productId.toString() === productId && item.size === size
            );

            if (existingItemIndex > -1) {
                const currentQuantity = cart.items[existingItemIndex].quantity;
                const newTotalQuantity = currentQuantity + quantity;

                if (newTotalQuantity > 5) {
                    return res.json({
                        status: false,
                        message: "Maximum quantity limit of 5 reached for this product in your cart.",
                    });
                }

                cart.items[existingItemIndex].quantity = newTotalQuantity;
                cart.items[existingItemIndex].totalPrice =
                    cart.items[existingItemIndex].price * newTotalQuantity;
            } else {
                if (quantity > 5) {
                    return res.json({
                        status: false,
                        message: "Cannot add more than 5 units of this product at once.",
                    });
                }
                cart.items.push({
                    productId,
                    quantity,
                    size,
                    price: product.salePrice,
                    totalPrice: product.salePrice * quantity,
                    addedOn: new Date()
                });
            }
        }

        await cart.save();
        return res.json({ status: true, message: "Product added to cart successfully" });
    } catch (error) {
        console.warn("Error adding to cart:", error);
        return res.status(500).json({ status: false, message: "Failed to add to cart" });
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        const { quantity } = req.body;
        const { cartItemId } = req.params;
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart) {
            return res.json({ status: false, message: "Cart not found" });
        }

        const cartItem = cart.items.find((item) => item._id.toString() === cartItemId);
        if (!cartItem) {
            return res.json({ status: false, message: "Item not found in cart" });
        }

        const product = cartItem.productId;
        const variant = product.variants.find((v) => v.size === cartItem.size);
        
        // Check stock availability
        if (quantity > variant.quantity) {
            return res.json({
                status: false,
                message: `Insufficient stock. Only ${variant.quantity} items available.`,
            });
        }

        // Enforce max quantity of 5
        if (quantity > 5) {
            return res.json({
                status: false,
                message: "Maximum quantity limit of 5 reached for this product.",
            });
        }

        const existingSize = cartItem.size;

        const updatedCart = await Cart.findOneAndUpdate(
            { userId, "items._id": cartItemId },
            {
                $set: {
                    "items.$.quantity": quantity,
                    "items.$.totalPrice": cartItem.price * quantity,
                    "items.$.size": existingSize,
                },
            },
            { new: true, runValidators: true }
        );

        if (!updatedCart) {
            return res.json({ status: false, message: "Failed to update cart" });
        }

        const cartTotal = updatedCart.items.reduce((total, item) => total + item.totalPrice, 0);

        return res.json({
            status: true,
            message: "Cart updated successfully",
            quantity,
            itemTotal: cartItem.price * quantity,
            cartTotal,
        });
    } catch (error) {
        console.warn("Error updating cart:", error);
        return res.status(500).json({
            status: false,
            message: "An error occurred while updating the cart",
        });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId: userId });
        if (!cart) {
            return res.status(404).json({ status: false, message: "Cart not found" });
        }

        cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);
        await cart.save();

        return res.json({ status: true, message: "Item removed from cart" });
    } catch (error) {
        console.error("Error removing from cart:", error);
        return res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

const validateCartForCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.json({ status: false, message: "User not authenticated" });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.json({ status: false, message: "Your cart is empty" });
        }

        const unavailableItems = [];

        for (const item of cart.items) {
            const product = item.productId;

            if (!product || product.isBlocked || product.status !== "Available") {
                unavailableItems.push({
                    name: product?.productName || "Unknown Product",
                    reason: product?.isBlocked ? "Product is blocked" : "Product is unavailable"
                });
                continue;
            }

            const variant = product.variants.find(v => v.size === item.size);
            if (!variant) {
                unavailableItems.push({
                    name: product.productName,
                    reason: `Size ${item.size} is not available`
                });
                continue;
            }

            if (variant.quantity < item.quantity) {
                unavailableItems.push({
                    name: product.productName,
                    reason: `Insufficient stock for size ${item.size}. Available: ${variant.quantity}, Requested: ${item.quantity}`
                });
            }
        }

        if (unavailableItems.length > 0) {
            return res.json({
                status: false,
                message: "Some items in your cart are unavailable",
                unavailableItems
            });
        }

        return res.json({ status: true, message: "Cart is valid for checkout" });
    } catch (error) {
        console.error("Error validating cart for checkout:", error);
        return res.status(500).json({ status: false, message: "Internal server error" });
    }
};

module.exports = {
    loadCart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    validateCartForCheckout,
    checkCartQuantity,
    checkStock
};