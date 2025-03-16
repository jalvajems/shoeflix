const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const PDFDocument = require('pdfkit');
const fs= require('fs')
const Razorpay = require('razorpay');
const { checkout } = require('../../routes/adminRouter');

const razorpay = new Razorpay({
  key_id: 'YOUR_RAZORPAY_KEY_ID',
  key_secret: 'YOUR_RAZORPAY_KEY_SECRET'
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

const processCheckout = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    console.log("addressid=====", addressId);
    console.log("payment method=====", paymentMethod);

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) return res.status(400).json({ error: 'Cart is empty' });

    const addressDoc = await Address.findOne({ userId });
    console.log("addressdoc========", addressDoc);

    const address = addressDoc.address.id(addressId);
    console.log("addresssss==========", address);

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

    const discount = 0;
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
    console.log('order============', order);

    if (paymentMethod === 'Razorpay') {
      const options = {
        amount: finalAmount * 100,
        currency: 'INR',
        receipt: order.orderId
      };
      const razorpayOrder = await razorpay.orders.create(options);
      order.paymentDetails = {
        razorpayOrderId: razorpayOrder.id,
        status: 'Pending'
      };
      await order.save();

      return res.json({
        razorpayOrderId: razorpayOrder.id,
        amount: options.amount,
        key: razorpay.key_id,
        orderId: order._id
      });
    } else { // COD
      await order.save();
      await Cart.findOneAndDelete({ userId });
      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId, 'variants.size': item.size },
          { $inc: { 'variants.$.quantity': -item.quantity, totalStock: -item.quantity } }
        );
      }
      res.redirect(`/thank-you?orderId=${order.orderId}`);
    }
  } catch (error) {
    console.error("Error in processCheckout:", error);
    res.status(500).json({ error: error.message });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const crypto = require('crypto');
    const generatedSignature = crypto.createHmac('sha256', razorpay.key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      const order = await Order.findById(orderId);
      order.paymentDetails.razorpayPaymentId = razorpay_payment_id;
      order.paymentDetails.razorpaySignature = razorpay_signature;
      order.paymentDetails.status = 'Success';
      order.status = 'Processing';
      await order.save();

      const cart = await Cart.findOneAndDelete({ userId: order.userId });
      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId, 'variants.size': item.size },
          { $inc: { 'variants.$.quantity': -item.quantity, totalStock: -item.quantity } }
        );
      }
      res.redirect(`/thank-you?orderId=${order.orderId}`);
    } else {
      res.status(400).json({ error: 'Payment verification failed' });
    }
  } catch (error) {
    console.error("Error in verifyRazorpayPayment:", error);
    res.status(500).json({ error: error.message });
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
      // If this is marked as default, unset others
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

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Pending' && order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason;

    for (const item of order.orderItems) {
      await Product.updateOne(
        { _id: item.product, 'variants.size': item.variants.size },
        { $inc: { 'variants.$.quantity': item.variants.quantity, totalStock: item.variants.quantity } }
      );
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
    const orderId = req.params.orderId; // MongoDB _id of the order
    const itemId = req.params.itemId; // MongoDB _id of the order item (subdocument)
    const reason = req.body.reason || 'User-initiated cancellation'; // Reason is optional

    // Find the order by MongoDB _id
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if the order can be cancelled
    if (order.status !== 'Pending' && order.status !== 'Processing') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this product' });
    }

    // Find the specific item in the orderItems array
    const item = order.orderItems.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

    // Update the item's status
    item.cancelStatus = 'Cancelled';
    item.cancellationReason = reason;

    // Restock the product
    await Product.updateOne(
      { _id: item.product, 'variants.size': item.variants.size },
      { $inc: { 'variants.$.quantity': item.variants.quantity, totalStock: item.variants.quantity } }
    );

    // Adjust the final amount
    order.finalAmount -= item.price * item.variants.quantity;

    // Check if all items are cancelled; if so, cancel the entire order
    const allCancelled = order.orderItems.every(item => item.cancelStatus === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
      order.cancellationReason = reason;
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
    const reason = req.body.reason;

    const order = await Order.findById(orderId);
    const item = order.orderItems.id(itemId);
    if (!order || !item || order.status !== 'Delivered' || new Date(order.createdOn).getTime() + 30*24*60*60*1000 < Date.now()) {
      return res.json({ success: false, message: 'Cannot return this product' });
    }

    item.returnStatus = 'Requested';
    item.returnReason = reason;
    item.returnRequestedAt = new Date();
    order.status = 'Return Request';
    await order.save();
    res.json({ success: true, message: 'Return requested successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// const downloadInvoice = async (req, res) => {
//   try {
//     console.log("reached at invoice");
    
//     const orderId = req.params.orderId;
//     const order = await Order.findOne({ orderId }).populate('orderItems.product');
//     if (!order) return res.status(404).send('Order not found');

//     const pdf = require('pdfkit');
//     const fs = require('fs');
//     const doc = new pdf();
//     const filePath = `public/invoices/invoice_${orderId}.pdf`;
//     doc.pipe(fs.createWriteStream(filePath));
//     doc.text(`Invoice for Order #${order.orderId}`, { align: 'center' });
//     doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
//     doc.text(`Shipping Address: ${order.address.name}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
//     order.orderItems.forEach(item => {
//       doc.text(`${item.name} (Size: ${item.variants.size}, Qty: ${item.variants.quantity}) - ₹${item.price}`);
//     });
//     doc.text(`Total: ₹${order.finalAmount}`);
//     doc.end();
//     res.download(filePath, `invoice_${orderId}.pdf`, () => fs.unlink(filePath, () => {}));
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
const downloadInvoice = async (req, res) => {
  try {
      const orderId = req.params.orderId;

      // Fetch the order with populated product and user data
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

      // Using the first address from the order's address array
      const selectedAddress = order.address[0];
      if (!selectedAddress) return res.status(404).send('Address not found');

      // Initialize PDF document
      const doc = new PDFDocument({
          margin: 50,
          size: 'A4',
          bufferPages: true,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);
      doc.pipe(res);

      // Header with "SHOEFLIX" branding
      doc.fontSize(24)
          .text('SHOEFLIX', 50, 50, { align: 'left' })
          .fontSize(10)
          .text('www.shoeflix.com', 50, 80, { align: 'left' }) // Update with your actual website
          .text('support@shoeflix.com', 50, 95, { align: 'left' }) // Update with your actual email
          .text('+91 98765 43210', 50, 110, { align: 'left' }); // Update with your actual phone number

      doc.fontSize(20)
          .text('INVOICE', 300, 50, { align: 'right', width: 250 })
          .fontSize(10)
          .text(`Invoice No: ${orderId}`, 300, 80, { align: 'right', width: 250 })
          .text(`Date: ${new Date().toLocaleDateString()}`, 300, 95, { align: 'right', width: 250 })
          .text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`, 300, 110, { align: 'right', width: 250 });

      doc.moveTo(50, 140).lineTo(550, 140).stroke();

      // Bill To Section
      doc.fontSize(14)
          .text('Bill To:', 50, 170)
          .fontSize(10)
          .text(selectedAddress.name || order.userId.name || 'Customer', 50, 190)
          .text(selectedAddress.landMark || '', 50, 205)
          .text(`${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}`, 50, 220)
          .text(`Phone: ${selectedAddress.phone || 'N/A'}`, 50, 235)
          .text(`Alt Phone: ${selectedAddress.altPhone || 'N/A'}`, 50, 250);

      // Items Table
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

      // Summary Section
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

      // Payment Information
      yPosition += 50;
      doc.fontSize(10)
          .text('Payment Information', 50, yPosition)
          .text(`Method: ${order.paymentMethod}`, 50, yPosition + 15)
          .text(`Status: ${order.status === 'Delivered' ? 'Paid' : order.paymentDetails?.status || order.status}`, 50, yPosition + 30);

      // Footer
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
  verifyRazorpayPayment,
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
