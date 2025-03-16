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

    res.render('orders', {
      orders,
      totalPages,
      currentPage: page,
      search,
      statusFilter,
      availableStatuses: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned']
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

    console.log('Populated Order:', JSON.stringify(order, null, 2));

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

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
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

    // Calculate refund amount
    const refundAmount = item.price * item.variants.quantity;

    // Update item status
    item.returnStatus = 'Approved';

    // Update product stock
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

    // Update wallet if payment method is not COD
    if (order.paymentMethod !== 'Cash on Delivery') {
      const user = await User.findById(order.userId._id);
      if (user) {
        // Find the pending transaction
        const transaction = user.walletHistory.find(
          tx => tx.orderId.toString() === orderId && tx.itemId.toString() === productId && tx.status === 'Pending'
        );
        if (transaction) {
          transaction.status = 'Completed';
          user.wallet += refundAmount;
        } else {
          // Fallback: Add a completed transaction if no pending one exists (shouldn't happen)
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

    // Update order status if all items are processed
    const allProcessed = order.orderItems.every(i =>
      i.cancelStatus === 'Cancelled' || i.returnStatus === 'Approved' || i.returnStatus === 'Rejected'
    );
    if (allProcessed) {
      order.status = order.orderItems.some(i => i.returnStatus === 'Approved') ? 'Returned' : 'Delivered';
    }

    await order.save();
    res.json({ success: true, message: 'Return approved successfully' });
  } catch (error) {
    console.error('Error approving return:', error);
    res.status(500).json({ success: false, message: 'Failed to approve return' });
  }
};
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

    // Update item status
    item.returnStatus = 'Rejected';

    // Remove pending transaction from wallet history
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

    // Update order status if all items are processed
    const allProcessed = order.orderItems.every(i =>
      i.cancelStatus === 'Cancelled' || i.returnStatus === 'Approved' || i.returnStatus === 'Rejected'
    );
    if (allProcessed) {
      order.status = 'Delivered';
    }

    await order.save();
    res.json({ success: true, message: 'Return rejected successfully' });
  } catch (error) {
    console.error('Error rejecting return:', error);
    res.status(500).json({ success: false, message: 'Failed to reject return' });
  }
};
module.exports = {
  loadOrderList,
  loadOrderDetails,
  updateOrderStatus,
  approveReturnRequest,
  rejectReturnRequest
};