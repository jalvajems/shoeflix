const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config(); // Load environment variables

// Initialize Razorpay with environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const loadCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log("userid=========", userId);
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found, rendering error");
      return res.status(404).render('error', { message: 'User not found' });
    }

    const addresses = await Address.findOne({ userId });
    console.log("address========", addresses);

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    console.log("cart============", cart);

    if (!cart || cart.items.length === 0) return res.redirect('/cart');

    const GST_RATE = 0.18; // 18% GST rate
    let totalPrice = 0;
    let totalGST = 0;
    let finalAmount = 0;

    cart.items.forEach(item => {
      const itemBasePrice = item.price; // Base price
      const itemGST = itemBasePrice * GST_RATE; // GST amount
      const itemTotalPrice = itemBasePrice + itemGST; // GST-inclusive price
      item.totalPriceWithGST = itemTotalPrice * item.quantity; // Total for this item with GST
      totalPrice += itemBasePrice * item.quantity; // Sum of base prices
      totalGST += itemGST * item.quantity; // Sum of GST
    });

    const discount = 0; // Add offer logic here later
    finalAmount = totalPrice + totalGST - discount; // Total including GST and discount

    if (addresses && addresses.address.length > 0 && !addresses.address.some(addr => addr.isDefault)) {
      addresses.address[0].isDefault = true;
      await addresses.save();
    }
    console.log("whats in req body =====", req.body.user);

    res.render('checkout', { addresses, cart, totalPrice, totalGST, discount, finalAmount, user });
  } catch (error) {
    console.error("Error in loadCheckoutPage:", error);
    res.status(500).json({ error: error.message });
  }
};

// Modified processCheckout to handle only COD
const processCheckout = async (req, res) => {
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    console.log("addressId:", addressId);
    console.log("paymentMethod:", paymentMethod);

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) return res.status(400).json({ error: 'Cart is empty' });

    const addressDoc = await Address.findOne({ userId });
    console.log("addressDoc:", addressDoc);

    const address = addressDoc.address.id(addressId);
    console.log("address:", address);

    if (!address) return res.status(400).json({ error: 'Invalid address' });

    const GST_RATE = 0.18;
    let totalPrice = 0;
    let totalGST = 0;
    let finalAmount = 0;

    cart.items.forEach(item => {
      const itemBasePrice = item.price;
      const itemGST = itemBasePrice * GST_RATE;
      const itemTotalPrice = itemBasePrice + itemGST;
      item.totalPriceWithGST = itemTotalPrice * item.quantity;
      totalPrice += itemBasePrice * item.quantity;
      totalGST += itemGST * item.quantity;
    });

    const discount = 0; // Add coupon logic here if needed
    finalAmount = totalPrice + totalGST - discount;

    const order = new Order({
      userId,
      orderItems: cart.items.map(item => ({
        product: item.productId,
        variants: { size: item.size, quantity: item.quantity },
        price: item.totalPriceWithGST // Use GST-inclusive price
      })),
      totalPrice: finalAmount, // Total including GST
      discount,
      finalAmount,
      address,
      paymentMethod,
      status: 'Pending'
    });
    console.log('order:', order);

    await order.save();

    // Clear cart and update stock
    await Cart.findOneAndDelete({ userId });
    for (const item of cart.items) {
      await Product.updateOne(
        { _id: item.productId, 'variants.size': item.size },
        { $inc: { 'variants.$.quantity': -item.quantity, totalStock: -item.quantity } }
      );
    }

    return res.status(200).json({
      success: true,
      orderId: order.orderId,
      message: 'Order placed successfully'
    });
  } catch (error) {
    console.error("Error in processCheckout:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// New function to create Razorpay order
const createRazorpayOrder = async (req, res) => {
  try {
    const { addressId, couponCode } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Your Cart is Empty' });
    }

    const addressDoc = await Address.findOne({ userId });
    const address = addressDoc.address.id(addressId);
    if (!address) {
      return res.status(400).json({ success: false, message: 'Invalid address' });
    }

    // Validate stock
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found for item: ${item.productId}`
        });
      }

      const variant = product.variants.find(v => v.size === item.size);
      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Size variant ${item.size} not found for product: ${product.productName}`
        });
      }

      if (variant.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.productName} (${item.size}). Only ${variant.quantity} available.`
        });
      }
    }

    const GST_RATE = 0.18;
    let totalPrice = 0;
    let totalGST = 0;
    let finalAmount = 0;

    cart.items.forEach(item => {
      const itemBasePrice = item.price;
      const itemGST = itemBasePrice * GST_RATE;
      const itemTotalPrice = itemBasePrice + itemGST;
      item.totalPriceWithGST = itemTotalPrice * item.quantity;
      totalPrice += itemBasePrice * item.quantity;
      totalGST += itemGST * item.quantity;
    });

    const discount = 0; // Add coupon logic if needed
    finalAmount = totalPrice + totalGST - discount;

    const receiptId = Math.random().toString(36).substring(2, 10);
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: receiptId,
      payment_capture: 1
    });

    const newOrder = new Order({
      userId,
      orderItems: cart.items.map(item => ({
        product: item.productId,
        variants: { size: item.size, quantity: item.quantity },
        price: item.totalPriceWithGST / item.quantity,
        name: item.productId.productName,
      })),
      totalPrice,
      discount,
      finalAmount,
      address,
      paymentMethod: 'Razorpay',
      status: 'Pending',
      paymentDetails: {
        razorpayOrderId: razorpayOrder.id,
        createdAt: new Date()
      }
    });

    await newOrder.save();

    // Update stock
    const stockUpdatePromises = cart.items.map(async (item) => {
      return await Product.findOneAndUpdate(
        {
          _id: item.productId,
          'variants.size': item.size
        },
        {
          $inc: { 'variants.$.quantity': -item.quantity }
        },
        { new: true }
      );
    });

    await Promise.all(stockUpdatePromises);
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    res.status(200).json({
      success: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      orderId: newOrder.orderId,
      discountAmount: discount
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Failed to create order", details: error.message });
  }
};

// Verify Razorpay Payment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.session.user;

    console.log('Verifying Razorpay Payment:', { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature });

    if (!userId) {
      console.error('User session not found in verifyRazorpayPayment');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.error('Invalid payment signature');
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const order = await Order.findOne({ orderId }).populate('orderItems.product');
    if (!order) {
      console.error('Order not found for orderId:', orderId);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Validate stock (optional, as stock is already updated in createRazorpayOrder)
    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      const variant = product.variants.find(v => v.size === item.variants.size);
      if (!variant || variant.quantity < item.variants.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name} (${item.variants.size})`
        });
      }
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { orderId },
      {
        status: 'Processing',
        'paymentDetails.razorpayOrderId': razorpayOrderId,
        'paymentDetails.razorpayPaymentId': razorpayPaymentId,
        'paymentDetails.razorpaySignature': razorpaySignature,
        'paymentDetails.succeededAt': new Date()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      orderId: updatedOrder.orderId
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Payment verification failed"
    });
  }
};

// Handle payment dismissal (e.g., if user closes Razorpay modal)
const handlePaymentDismissal = async (req, res) => {
  try {
    const { orderId, addressId, reason } = req.body;
    // Optionally, update the order status to 'Failed' or take other actions
    console.log(`Payment dismissed for order ${orderId}. Reason: ${reason}`);
    res.status(200).json({ success: true, message: 'Payment dismissal handled' });
  } catch (error) {
    console.error("Error handling payment dismissal:", error);
    res.status(500).json({ success: false, message: "Failed to handle payment dismissal" });
  }
};

const loadCheckoutAddress = (req, res) => {
  res.render('checkout-address');
};

const addressPost = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressData = { ...req.body, isDefault: false }; // Default to false initially
    let addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      addressDoc = new Address({ userId, address: [{ ...addressData, isDefault: true }] }); // First address is default
    } else {
      if (req.body.isDefault === 'true') {
        addressDoc.address.forEach(addr => (addr.isDefault = false));
        addressData.isDefault = true;
      }
      addressDoc.address.push(addressData);
    }
    await addressDoc.save();
    res.redirect('/checkout');
  } catch (error) {
    console.error("Error in addressPost:", error);
    res.status(500).json({ error: error.message });
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;
    console.log("loadedit id", addressId);
    const addressDoc = await Address.findOne({ userId });
    const address = addressDoc.address.id(addressId);

    if (!address) return res.status(404).json({ error: 'Address not found' });
    return res.render('checkout-edit-address', { address });
  } catch (error) {
    console.log("loadedit error========", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const editAddress = async (req, res) => {
  console.log("reached editaddress");
  try {
    console.log("enter edit address");
    const userId = req.session.user;
    const addressId = req.params.id;
    console.log(addressId);
    const addressDoc = await Address.findOne({ userId });
    const address = addressDoc.address.id(addressId);
    console.log("address", address);

    if (!address) return res.status(404).json({ error: 'Address not found' });

    if (req.body.isDefault === 'true') {
      addressDoc.address.forEach(addr => (addr.isDefault = false));
      req.body.isDefault = true;
    }
    Object.assign(address, req.body);
    await addressDoc.save();
    return res.redirect('/checkout');
  } catch (error) {
    console.error("Error in editAddress:", error);
    res.status(500).json({ error: error.message });
  }
};

const loadThankYouPage = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.query.orderId }).populate('orderItems.product');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.render('thankyou', { order });
  } catch (error) {
    console.error("Error in loadThankYouPage:", error);
    res.status(500).json({ error: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const reason = req.body.reason || 'User-initiated cancellation';

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Pending' && order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
    }

    const refundAmount = order.finalAmount;
    console.log("refund amount===========", refundAmount);

    order.status = 'Cancelled';
    order.cancellationReason = reason;

    for (const item of order.orderItems) {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.variants.size },
        { $inc: { 'variants.$.quantity': item.variants.quantity, totalStock: item.variants.quantity } }
      );
    }

    if (order.paymentMethod !== 'COD') {
      const user = await User.findById(order.userId._id);
      if (user) {
        user.wallet = (parseFloat(user.wallet) || 0) + refundAmount;        user.walletHistory.push({
          transactionId: `TXN-${Date.now()}`,
          type: 'credit',
          amount: refundAmount,
          status: 'Completed',
          orderId: order._id,
          description: `Refund for canceled order #${order.orderId}`
        });
        await user.save();
      }
    }

    await order.save();
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'An error occurred while cancelling the order.' });
  }
};

const cancelProduct = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;
    const reason = req.body.reason || 'User-initiated cancellation';

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Pending' && order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this product' });
    }

    const item = order.orderItems.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

    const refundAmount = item.price * item.variants.quantity;

    item.cancelStatus = 'Cancelled';
    item.cancellationReason = reason;

    await Product.updateOne(
      { _id: item.product, 'variants.size': item.variants.size },
      { $inc: { 'variants.$.quantity': item.variants.quantity, totalStock: item.variants.quantity } }
    );

    order.finalAmount -= refundAmount;

    const allCancelled = order.orderItems.every(item => item.cancelStatus === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
      order.cancellationReason = reason;
    }

    if (order.paymentMethod !== 'Cash on Delivery') {
      const user = await User.findById(order.userId._id);
      if (user) {
        user.wallet += refundAmount;
        user.walletHistory.push({
          transactionId: `TXN-${Date.now()}`,
          type: 'credit',
          amount: refundAmount,
          status: 'Completed',
          orderId: order._id,
          itemId: item._id,
          description: `Refund for canceled product in order #${order.orderId}`
        });
        await user.save();
      }
    }

    await order.save();
    res.json({ success: true, message: 'Product cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling product:', error);
    res.status(500).json({ success: false, message: 'An error occurred while cancelling the product.' });
  }
};

const returnProduct = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;
    const reason = req.body.reason 

    const order = await Order.findById(orderId).populate('userId');
    const item = order.orderItems.id(itemId);
    if (
      !order ||
      !item ||
      order.status !== 'Delivered' ||
      new Date(order.createdOn).getTime() + 30 * 24 * 60 * 60 * 1000 < Date.now()
    ) {
      return res.json({ success: false, message: 'Cannot return this product' });
    }

    const refundAmount = item.price * item.variants.quantity;

    item.returnStatus = 'Requested';
    item.returnReason = reason;
    item.returnRequestedAt = new Date();
    order.status = 'Return Request';

    if (order.paymentMethod !== 'Cash on Delivery') {
      const user = await User.findById(order.userId._id);
      if (user) {
        user.walletHistory.push({
          transactionId: `TXN-${Date.now()}`,
          type: 'credit',
          amount: refundAmount,
          status: 'Pending',
          orderId: order._id,
          itemId: item._id,
          description: `Pending refund for return request in order #${order.orderId}`
        });
        await user.save();
      }
    }

    await order.save();
    res.json({ success: true, message: 'Return requested successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findOne({ orderId })
      .populate({
        path: 'orderItems.product',
        select: 'productName variants',
      })
      .populate({
        path: 'userId',
        select: 'name',
      })
      .lean();

    if (!order) return res.status(404).send('Order not found');

    const selectedAddress = order.address;
    if (!selectedAddress) return res.status(404).send('Address not found');

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);
    doc.pipe(res);

    doc.fontSize(24)
      .text('SHOEFLIX', 50, 50, { align: 'left' })
      .fontSize(10)
      .text('www.shoeflix.com', 50, 80, { align: 'left' })
      .text('support@shoeflix.com', 50, 95, { align: 'left' })
      .text('+91 98765 43210', 50, 110, { align: 'left' });

    doc.fontSize(20)
      .text('INVOICE', 300, 50, { align: 'right', width: 250 })
      .fontSize(10)
      .text(`Invoice No: ${orderId}`, 300, 80, { align: 'right', width: 250 })
      .text(`Date: ${new Date().toLocaleDateString()}`, 300, 95, { align: 'right', width: 250 })
      .text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`, 300, 110, { align: 'right', width: 250 });

    doc.moveTo(50, 140).lineTo(550, 140).stroke();

    doc.fontSize(14)
      .text('Bill To:', 50, 170)
      .fontSize(10)
      .text(selectedAddress.name || order.userId.name || 'Customer', 50, 190)
      .text(selectedAddress.landMark || '', 50, 205)
      .text(`${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}`, 50, 220)
      .text(`Phone: ${selectedAddress.phone || 'N/A'}`, 50, 235)
      .text(`Alt Phone: ${selectedAddress.altPhone || 'N/A'}`, 50, 250);

    const tableTop = 300;
    const tableHeaders = {
      item: { x: 50, width: 200 },
      size: { x: 250, width: 50 },
      qty: { x: 300, width: 70 },
      price: { x: 370, width: 90 },
      amount: { x: 460, width: 90 },
    };

    doc.rect(50, tableTop - 10, 500, 25).fill('#f6f6f6');
    doc.fillColor('black')
      .fontSize(10)
      .text('Item Description', tableHeaders.item.x, tableTop)
      .text('Size', tableHeaders.size.x, tableTop, { width: tableHeaders.size.width, align: 'center' })
      .text('Qty', tableHeaders.qty.x, tableTop, { width: tableHeaders.qty.width, align: 'center' })
      .text('Unit Price', tableHeaders.price.x, tableTop, { width: tableHeaders.price.width, align: 'right' })
      .text('Amount', tableHeaders.amount.x, tableTop, { width: tableHeaders.amount.width, align: 'right' });

    let yPosition = tableTop + 30;
    let subtotal = 0;

    order.orderItems.forEach((item) => {
      const price = item.price || 0;
      const amount = item.variants.quantity * price;
      subtotal += amount;

      doc.text(item.product.productName, tableHeaders.item.x, yPosition, { width: tableHeaders.item.width })
        .text(item.variants.size, tableHeaders.size.x, yPosition, { width: tableHeaders.size.width, align: 'center' })
        .text(item.variants.quantity.toString(), tableHeaders.qty.x, yPosition, { width: tableHeaders.qty.width, align: 'center' })
        .text(`₹${price.toFixed(2)}`, tableHeaders.price.x, yPosition, { width: tableHeaders.price.width, align: 'right' })
        .text(`₹${amount.toFixed(2)}`, tableHeaders.amount.x, yPosition, { width: tableHeaders.amount.width, align: 'right' });

      yPosition += 25;
    });

    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 20;

    const summaryX = 370;
    const summaryWidth = 180;

    doc.text('Subtotal:', summaryX, yPosition, { width: 90, align: 'right' })
      .text(`₹${subtotal.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });

    if (order.discount > 0) {
      yPosition += 20;
      doc.text('Discount:', summaryX, yPosition, { width: 90, align: 'right' })
        .text(`-₹${order.discount.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });
    }

    if (order.couponApplied && order.couponCode) {
      yPosition += 20;
      doc.text(`Coupon (${order.couponCode}):`, summaryX, yPosition, { width: 90, align: 'right' });
    }

    yPosition += 25;
    doc.rect(summaryX - 10, yPosition - 5, summaryWidth, 25).fill('#f6f6f6');
    doc.fillColor('black')
      .fontSize(12)
      .text('Total:', summaryX, yPosition, { width: 90, align: 'right' })
      .text(`₹${order.finalAmount.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });

    yPosition += 50;
    doc.fontSize(10)
      .text('Payment Information', 50, yPosition)
      .text(`Method: ${order.paymentMethod}`, 50, yPosition + 15)
      .text(`Status: ${order.status === 'Delivered' ? 'Paid' : order.paymentDetails?.status || order.status}`, 50, yPosition + 30);

    doc.fontSize(10)
      .text('Thank you for shopping with SHOEFLIX!', 50, doc.page.height - 100, { align: 'center' })
      .fontSize(8)
      .text('Terms & Conditions:', 50, doc.page.height - 80)
      .text('1. All prices are in INR and include GST where applicable.', 50, doc.page.height - 70)
      .text('2. This is a computer-generated invoice and requires no signature.', 50, doc.page.height - 60);

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

module.exports = {
  loadCheckoutPage,
  processCheckout,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentDismissal,
  loadCheckoutAddress,
  addressPost,
  loadEditAddress,
  editAddress,
  loadThankYouPage,
  cancelOrder,
  cancelProduct,
  returnProduct,
  downloadInvoice
};