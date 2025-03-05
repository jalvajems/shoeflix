const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const productController=require("../controllers/user/productController")
const passport = require("passport")
const { route } = require("../app")

router.get('/pageNotFound', userController.pageNotFound)


router.get('/',userAuth, userController.loadHomepage)
router.get('/shop',userAuth, userController.loadShopping)
router.get("/filter", userAuth, userController.filterProduct);
router.get("/filterPrice", userAuth, userController.filterByPrice);

router.post('/signup', userController.signup)
router.get('/signup', userController.loadSignup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})

router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get('/profile',userAuth, userController.loadProfile);

router.get('/logout',userController.logout)


router.get('/productDetails/:id',userAuth,productController.productDetails)

module.exports = router