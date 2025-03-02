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
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)
//this is customers routings========================
router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)
//this is category routings==========================
router.get('/category',adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth,categoryController.addCategory);

// Category listing and unlisting=========================
router.get('/listCategory/:id',adminAuth, categoryController.listCategory);
router.get('/unlistCategory/:id',adminAuth, categoryController.unlistCategory);

// Category editing=================
router.get('/editCategory/:id', adminAuth,categoryController.getEditCategory);
router.post('/updateCategory/:id',adminAuth, categoryController.updateCategory);

// Category deletion========================
router.delete('/deleteCategory/:id',adminAuth, categoryController.deleteCategory);

// // Category offers===========================
// router.post('/addCategoryOffer/:id', categoryController.addCategoryOffer);
// router.post('/removeCategoryOffer/:id', categoryController.removeCategoryOffer);

//product managment=========================
router.get("/addProducts",adminAuth,productController.getProductAddPage)
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProducts)
router.get("/blockProduct",adminAuth,productController.blockProduct)
router.get("/unblockProduct",adminAuth,productController.unblockProduct)

module.exports=router