const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

const ITEMS_PER_PAGE = 5;

// Load Order List
const loadOrderList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const statusFilter = req.query.status || '';
    const skip = (page - 1) * ITEMS_PER_PAGE;

    const query = {};
    if (search) query.orderId = new RegExp(search, 'i');
    if (statusFilter) query.status = statusFilter;

    const orders = await Order.find(query)
      .populate('userId', 'name phone')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(ITEMS_PER_PAGE);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);
console.log("what's inside the order in orderController========",orders);

    res.render('orders', {
      orders,
      totalPages,
      currentPage: page,
      search,
      statusFilter,
      availableStatuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Cancellation Requested', 'Returned']
    });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(500).render('admin/pageerror', { message: 'Failed to load orders' });
  }
};

// Load Order Details
const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('userId', 'name phone')
      .populate({
        path: 'orderItems.product',
        select: 'productName productImage'
      });

    if (!order) {
      return res.status(404).render('admin/pageerror', { message: 'Order not found' });
    }

    res.render('order-details', { order });
  } catch (error) {
    console.error('Error loading order details:', error);
    res.status(500).render('pageerror', { message: 'Failed to load order details' });
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentStatus = order.status;
    if (currentStatus === 'Delivered' || currentStatus === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update Delivered or Cancelled orders' });
    }
    if (currentStatus === 'Shipped' && (status === 'Pending' || status === 'Processing')) {
      return res.status(400).json({ success: false, message: 'Cannot revert Shipped status to Pending or Processing' });
    }

    order.status = status;
    if (status === 'Delivered') order.invoiceDate = new Date();
    await order.save();

    res.json({ success: true, message: 'Order status updated successfully', reload: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Approve Return Request
const approveReturnRequest = async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderItems.id(productId);
    if (!item || item.returnStatus !== 'Requested') {
      return res.status(400).json({ success: false, message: 'No active return request for this item' });
    }

    const refundAmount = item.price * item.variants.quantity;

    item.returnStatus = 'Approved';

    const product = await Product.findById(item.product);
    if (product) {
      const variant = product.variants.find(v => v.size === item.variants.size);
      if (variant) {
        variant.quantity += item.variants.quantity;
        product.totalStock += item.variants.quantity;
        product.status = product.totalStock > 0 ? 'Available' : 'Out of stock';
        await product.save();
      }
    }

    if (order.paymentMethod !== 'Cash on Delivery') {
      const user = await User.findById(order.userId._id);
      if (user) {
        const transaction = user.walletHistory.find(
          tx => tx.orderId.toString() === orderId && tx.itemId.toString() === productId && tx.status === 'Pending'
        );
        if (transaction) {
          transaction.status = 'Completed';
          user.wallet += refundAmount;
        } else {
          user.walletHistory.push({
            transactionId: `TXN-${Date.now()}`,
            type: 'credit',
            amount: refundAmount,
            status: 'Completed',
            orderId: order._id,
            itemId: item._id,
            description: `Refund for approved return in order #${order.orderId}`
          });
          user.wallet += refundAmount;
        }
        await user.save();
      }
    }

    const allProcessed = order.orderItems.every(i =>
      i.cancelStatus === 'Cancelled' || i.returnStatus === 'Approved' || i.returnStatus === 'Rejected'
    );
    if (allProcessed) {
      order.status = order.orderItems.some(i => i.returnStatus === 'Approved') ? 'Returned' : 'Delivered';
    }

    await order.save();
    res.json({ success: true, message: 'Return approved successfully', reload: true });
  } catch (error) {
    console.error('Error approving return:', error);
    res.status(500).json({ success: false, message: 'Failed to approve return' });
  }
};

// Reject Return Request
const rejectReturnRequest = async (req, res) => {
  try {
    const { orderId, productId } = req.body;

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const item = order.orderItems.id(productId);
    if (!item || item.returnStatus !== 'Requested') {
      return res.status(400).json({ success: false, message: 'No active return request for this item' });
    }

    item.returnStatus = 'Rejected';

    if (order.paymentMethod !== 'Cash on Delivery') {
      const user = await User.findById(order.userId._id);
      if (user) {
        const transactionIndex = user.walletHistory.findIndex(
          tx => tx.orderId.toString() === orderId && tx.itemId.toString() === productId && tx.status === 'Pending'
        );
        if (transactionIndex !== -1) {
          user.walletHistory.splice(transactionIndex, 1);
          await user.save();
        }
      }
    }

    const allProcessed = order.orderItems.every(i =>
      i.cancelStatus === 'Cancelled' || i.returnStatus === 'Approved' || i.returnStatus === 'Rejected'
    );
    if (allProcessed) {
      order.status = 'Delivered';
    }

    await order.save();
    res.json({ success: true, message: 'Return rejected successfully', reload: true });
  } catch (error) {
    console.error('Error rejecting return:', error);
    res.status(500).json({ success: false, message: 'Failed to reject return' });
  }
};

// Approve Cancellation Request
const approveCancellationRequest = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Cancellation Requested') {
      return res.status(400).json({ success: false, message: 'No active cancellation request for this order' });
    }

    order.status = 'Cancelled';
    order.cancellationApprovedAt = new Date();

    if (order.paymentMethod !== 'Cash on Delivery') {
      const user = await User.findById(order.userId._id);
      if (user) {
        const refundAmount = order.finalAmount;
        user.wallet += refundAmount;
        user.walletHistory.push({
          transactionId: `TXN-${Date.now()}`,
          type: 'credit',
          amount: refundAmount,
          status: 'Completed',
          orderId: order._id,
          description: `Refund for cancelled order #${order.orderId}`
        });
        await user.save();
      }
    }

    for (const item of order.orderItems) {
      const product = await Product.findById(item.product);
      if (product) {
        const variant = product.variants.find(v => v.size === item.variants.size);
        if (variant) {
          variant.quantity += item.variants.quantity;
          product.totalStock += item.variants.quantity;
          product.status = product.totalStock > 0 ? 'Available' : 'Out of stock';
          await product.save();
        }
      }
    }

    await order.save();
    res.json({ success: true, message: 'Cancellation approved successfully', reload: true });
  } catch (error) {
    console.error('Error approving cancellation:', error);
    res.status(500).json({ success: false, message: 'Failed to approve cancellation' });
  }
};

// Reject Cancellation Request
const rejectCancellationRequest = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Cancellation Requested') {
      return res.status(400).json({ success: false, message: 'No active cancellation request for this order' });
    }

    order.status = order.cancellationRequestedAt > order.createdOn ? 'Processing' : 'Pending';
    order.cancellationReason = '';
    order.cancellationRequestedAt = null;
    await order.save();

    res.json({ success: true, message: 'Cancellation request rejected successfully', reload: true });
  } catch (error) {
    console.error('Error rejecting cancellation:', error);
    res.status(500).json({ success: false, message: 'Failed to reject cancellation' });
  }
};

module.exports = {
  loadOrderList,
  loadOrderDetails,
  updateOrderStatus,
  approveReturnRequest,
  rejectReturnRequest,
  approveCancellationRequest,
  rejectCancellationRequest
};