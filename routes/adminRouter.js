const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const couponController = require("../controllers/admin/couponController");
const offerController = require("../controllers/admin/offerController");
const walletController = require("../controllers/admin/adminWalletController"); 
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });

router.get("/pageerror", adminController.pageerror);

router.route("/login")
  .get(adminController.loadLogin)
  .post(adminController.login);

router.get('/dashboard', adminAuth, adminController.loadDashboard);
router.get('/sales-report', adminAuth, adminController.generateSalesReport);
router.get('/download/excel', adminAuth, adminController.downloadExcelReport);
router.get('/download/pdf', adminAuth, adminController.downloadPDFReport);

router.get("/logout", adminController.logout);

// Customers routings
router.get("/users", adminAuth, customerController.customerInfo);
router.route("/customers/:id/block")
  .patch(adminAuth, customerController.customerBlocked);
router.route("/customers/:id/unblock")
  .patch(adminAuth, customerController.customerUnBlocked);

// Category routings
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.route("/category/:id/list")
  .patch(adminAuth, categoryController.listCategory);
router.route("/category/:id/unlist")
  .patch(adminAuth, categoryController.unlistCategory);
router.get('/editCategory/:id', adminAuth, categoryController.getEditCategory);
router.put('/updateCategory/:id', adminAuth, categoryController.updateCategory);

// Product management
router.route("/addProducts")
  .get(adminAuth, productController.getProductAddPage)
  .post(adminAuth, uploads.array("images", 4), productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, uploads.array('images', 4), productController.editProduct);
router.delete("/deleteImage", adminAuth, productController.deleteSingleImage);
router.route('/product/:id/block')
  .put(adminAuth, productController.blockProduct);
router.route('/product/:id/unblock')
  .put(adminAuth, productController.unblockProduct);

// Order Management
router.get('/orders', adminAuth, orderController.loadOrderList);
router.get('/orders/:id', adminAuth, orderController.loadOrderDetails);
router.post('/updateOrderStatus/:id', adminAuth, orderController.updateOrderStatus);
router.post('/approve-return', adminAuth, orderController.approveReturnRequest);
router.post('/reject-return', adminAuth, orderController.rejectReturnRequest);
router.post('/approve-cancellation', adminAuth, orderController.approveCancellationRequest); // New route
router.post('/reject-cancellation', adminAuth, orderController.rejectCancellationRequest);   // New route

// Coupon management
router.get('/coupon', adminAuth, couponController.loadCoupon);
router.post('/coupon', adminAuth, couponController.createCoupon);
router.put('/coupon/:couponId', adminAuth, couponController.editCoupon);
router.delete('/coupon/:couponId', adminAuth, couponController.deleteCoupon);

// Offer management
router.get('/offer', adminAuth, offerController.loadOffer);
router.get('/offer-list', adminAuth, offerController.offerList);
router.post('/offer', adminAuth, offerController.addOffer);
router.get('/offer/:offerId', adminAuth, offerController.getOffer);
router.put('/offer-update/:offerId', adminAuth, offerController.updateOffer);
router.get('/offer-remove/:offerId', adminAuth, offerController.removeOffer);
router.get('/category-products/:categoryId',adminAuth, offerController.getCategoryProducts);
// Wallet Management 
router.get("/wallet-management", adminAuth, walletController.loadWalletManagement);
router.get("/transaction-details/:transactionId", adminAuth, walletController.loadTransactionDetails);

module.exports = router;