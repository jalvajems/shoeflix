const express=require("express");
const router=express.Router();
const adminController=require("../controllers/admin/adminController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")


router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)
//this is customers routings
router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)
//this is category routings
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)

module.exports=router