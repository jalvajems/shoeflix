const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

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
        console.log("Filtered Items:", filteredItems);
        const totalPrice = filteredItems.reduce((acc, item) => acc + item.totalPrice, 0);

        return res.render("cart", {
            user: await User.findById(userId),
            cart: filteredItems,
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

      console.log("reqbody",req.body)
  
      if (!userId) {
        return res.json({ status: false, message: "User not authenticated" });
      }
      // First, check if product exists and get its price
      const product = await Product.findById(productId);
      if (!product || product.isBlocked || product.status !== 'Available') {
        return res.json({ status: false, message: "Product not available" });
      }
  
      // Validate the size is one of the allowed enum values
      const validSizes = ['IND-5', 'IND-6', 'IND-7', 'IND-8'];
      if (!validSizes.includes(size)) {
        return res.json({ status: false, message: "Invalid size selected" });
      }
  
      // Check if the cart exists for the user
      let cart = await Cart.findOne({ userId });
  
      if (!cart) {
        // Create new cart if it doesn't exist
        cart = new Cart({
            userId: userId,
          items: [{
            productId,
            quantity,

            
            size, // Make sure size is included here
            price: product.salePrice,
            totalPrice: product.salePrice * quantity
          }]
        });
      } else {
        // Check if this product with the same size already exists in the cart
        const existingItemIndex = cart.items.findIndex(
          item => item.productId.toString() === productId && item.size === size
        );
  
        if (existingItemIndex > -1) {
          // Update quantity if product already in cart
          cart.items[existingItemIndex].quantity += quantity;
          cart.items[existingItemIndex].totalPrice = 
            cart.items[existingItemIndex].price * cart.items[existingItemIndex].quantity;
        } else {
          // Add new item to cart
          cart.items.push({
            productId,
            quantity,
            size, // Make sure size is included here
            price: product.salePrice,
            totalPrice: product.salePrice * quantity
          });
        }
      }
  
      // Save the cart
      await cart.save();
      
      return res.json({ status: true, message: "Product added to cart successfully" });
    } catch (error) {
      console.warn("Error adding to cart:", error);
      return res.status(500).json({ status: false, message: "Failed to add to cart" });
    }
  };
// In your cartController.js file, modify the updateCartQuantity function:

const updateCartQuantity = async (req, res) => {
    try {
      const {  quantity } = req.body;
      const {cartItemId} = req.params
      const userId = req.session.user
       
      console.log("req.body",req.body)
      // First, find the cart and the specific item to get its current data
      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.json({ status: false, message: "Cart not found" });
      }
  
      // Find the specific item in the cart
      const cartItem = cart.items.find(item => item._id.toString() === cartItemId);
      if (!cartItem) {
        return res.json({ status: false, message: "Item not found in cart" });
      }
  
      // Get the existing size before updating
      const existingSize = cartItem.size;
      
      // Now update with the size preserved
      const updatedCart = await Cart.findOneAndUpdate(
        { userId, "items._id": cartItemId },
        { 
          $set: { 
            "items.$.quantity": quantity,
            "items.$.totalPrice": cartItem.price * quantity,
            // Ensure the size is included in the update
            "items.$.size": existingSize
          } 
        },
        { new: true, runValidators: true }
      );
  
      if (!updatedCart) {
        return res.json({ status: false, message: "Failed to update cart" });
      }
  
      // Calculate updated cart totals
      const cartTotal = updatedCart.items.reduce((total, item) => total + item.totalPrice, 0);
      
      return res.json({
        status: true,
        message: "Cart updated successfully",
        quantity,
        itemTotal: cartItem.price * quantity,
        cartTotal
      });
    } catch (error) {
      console.warn("Error updating cart:", error);
      return res.status(500).json({ status: false, message: "An error occurred while updating the cart" });
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

module.exports = {
    loadCart,
    addToCart,
    updateCartQuantity,
    removeFromCart
};