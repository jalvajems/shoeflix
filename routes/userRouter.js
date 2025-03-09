const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const productController=require("../controllers/user/productController")
const profileController=require("../controllers/user/profileController")
const passport = require("passport")
const { route } = require("../app")

router.get('/pageNotFound', userController.pageNotFound)


router.get('/',userAuth, userController.loadHomepage)
router.get('/shop',userAuth, userController.loadShopping)
router.get("/filter", userAuth, userController.filterProduct);
router.get("/filterPrice", userAuth, userController.filterByPrice);

router
.route("/signup")
.get( userController.loadSignup)
.post( userController.signup)

router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})
//login =======================
router
.route("/login")
.get(userController.loadLogin)
.post(userController.login)



router.get('/logout',userController.logout)
//profile managment=============================
router.get('/productDetails/:id',userAuth,productController.productDetails)
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", profileController.getResetPassPage);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.post("/reset-password", profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.userProfile)
router.get("/reset-password", profileController.getResetPassPage);

router.route("/change-email")
.get(userAuth,profileController.changeEmail)
.post(userAuth,profileController.changeEmailValid)
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp);
router.route("/update-email") 
.get(userAuth, profileController.getUpdateEmailPage)
.post(userAuth, profileController.updateEmail)

router.route("/change-password")
.get(userAuth,profileController.changePassword)
.post(userAuth,profileController.changePasswordValid)
router.post("/verify-password-otp",userAuth,profileController.verifyChangePassOtp)


//address ====================================================

router.route("/addAddress")
.get(userAuth, profileController.addAddress)
.post( userAuth, profileController.postAddAddress);

router.route("/editAddress")
.get(userAuth,profileController.editAddress)
.post(userAuth,profileController.postEditAddress)

router.get("/deleteAddress", userAuth, profileController.deleteAddress);


// router.get("/change-password",userAuth,profileController.changePassword)

module.exports = router