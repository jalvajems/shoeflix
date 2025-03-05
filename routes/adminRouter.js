const express=require("express");
const router=express.Router();
const adminController=require("../controllers/admin/adminController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController")
const multer=require("multer")
const storage=require("../helpers/multer");
const { route } = require("./userRouter");
const uploads=multer({storage:storage})

router.get("/pageerror",adminController.pageerror)

router.route("/login")
.get(adminController.loadLogin)
.post(adminController.login)


router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)
//this is customers routings========================
router.get("/users",adminAuth,customerController.customerInfo)
router
  .route("/customers/:id/block")
  .patch(adminAuth, customerController.customerBlocked); // Block user

router
  .route("/customers/:id/unblock")
  .patch(adminAuth, customerController.customerUnBlocked); // Unblock user

//this is category routings==========================
router.get('/category',adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth,categoryController.addCategory);

router
.route("/category/:id/list")
.patch(adminAuth, categoryController.listCategory)

router
.route("/category/:id/unlist")
.patch(adminAuth, categoryController.unlistCategory)

// Category editing=================
router.get('/editCategory/:id', adminAuth,categoryController.getEditCategory);
router.put('/updateCategory/:id',adminAuth, categoryController.updateCategory);



//product managment=========================
router.route("/addProducts")
.get(adminAuth,productController.getProductAddPage)
.post(adminAuth,uploads.array("images",4),productController.addProducts)

router.get("/products",adminAuth,productController.getAllProducts)

router.get("/editProduct",adminAuth, productController.getEditProduct)
router.post('/editProduct/:id',adminAuth, uploads.array('images', 4), productController.editProduct)
router.delete("/deleteImage",adminAuth, productController.deleteSingleImage);



// Block/Unblock product routes
router.route('/product/:id/block')
    .put(adminAuth, productController.blockProduct);

router.route('/product/:id/unblock')
    .put(adminAuth, productController.unblockProduct);




module.exports=router