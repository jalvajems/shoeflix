const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

// Load Wallet Management Page
const loadWalletManagement = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Transactions per page
    const skip = (page - 1) * limit;

    // Fetch all users with wallet history
    const users = await User.find({ "walletHistory.0": { $exists: true } })
      .populate({
        path: "walletHistory.orderId",
        select: "orderId status returnStatus cancellationReason createdOn"
      })
      .lean();

    // Flatten wallet history into a single array
    let allTransactions = [];
    users.forEach(user => {
      user.walletHistory.forEach(transaction => {
        allTransactions.push({
          transactionId: transaction.transactionId,
          date: transaction.date,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email
          },
          type: transaction.type,
          amount: transaction.amount,
          status: transaction.status,
          orderId: transaction.orderId ? transaction.orderId._id : null,
          orderNumber: transaction.orderId ? transaction.orderId.orderId : null,
          orderStatus: transaction.orderId ? transaction.orderId.status : null,
          returnStatus: transaction.orderId ? transaction.orderId.returnStatus : null
        });
      });
    });

    // Sort by date (latest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const totalTransactions = allTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    const paginatedTransactions = allTransactions.slice(skip, skip + limit);

    res.render("wallet-management", {
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error("Error loading wallet management:", error);
    res.redirect("/admin/pageerror");
  }
};

const loadTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const user = await User.findOne({ "walletHistory.transactionId": transactionId })
      .populate({
        path: "walletHistory.orderId",
        select: "orderId status returnStatus cancellationReason createdOn finalAmount"
      })
      .lean();

    if (!user) {
      return res.redirect("/admin/pageerror");
    }

    // Find the specific transaction
    const transaction = user.walletHistory.find(t => t.transactionId === transactionId);
    if (!transaction) {
      return res.redirect("/admin/pageerror");
    }

    res.render("transaction-details", {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone || "N/A"
      },
      transaction
    });
  } catch (error) {
    console.error("Error loading transaction details:", error);
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  loadWalletManagement,
  loadTransactionDetails
};