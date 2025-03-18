const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const productController=require("../controllers/user/productController")
const profileController=require("../controllers/user/profileController")
const cartController=require("../controllers/user/cartController")
const checkoutController=require("../controllers/user/checkoutController")
const couponController=require("../controllers/user/couponController")
const wishlistController=require("../controllers/user/wishlistController")
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
router.post("/submit-review", productController.submitReview);

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

//cart managment=============================================

router.get("/cart", userAuth, cartController.loadCart);
router.post("/add-to-cart", userAuth, cartController.addToCart);
router.post("/update-cart/:cartItemId", userAuth, cartController.updateCartQuantity);
router.delete("/remove-from-cart/:cartItemId", userAuth, cartController.removeFromCart);
router.get("/validate-cart-for-checkout", cartController.validateCartForCheckout);

//checkout======================================================
router.get('/checkout', userAuth, checkoutController.loadCheckoutPage);
router.post('/checkout', userAuth, checkoutController.processCheckout);
router.post('/create-razorpay-order', userAuth, checkoutController.createRazorpayOrder);
router.post('/verify-razorpay-payment', userAuth, checkoutController.verifyRazorpayPayment);
router.post('/handle-payment-dismissal', userAuth, checkoutController.handlePaymentDismissal);
router.get('/checkout-address', userAuth, checkoutController.loadCheckoutAddress);
router.post('/checkout-address', userAuth, checkoutController.addressPost);
router.get('/api/addresses/:id/edit', userAuth, checkoutController.loadEditAddress);
router.post('/api/addresses/:id/edit', userAuth, checkoutController.editAddress);
router.get('/thank-you', userAuth, checkoutController.loadThankYouPage);
router.post('/cancel-order/:orderId', userAuth, checkoutController.cancelOrder);
router.post('/cancel-product/:orderId/:itemId', userAuth, checkoutController.cancelProduct);
router.post('/return-product/:orderId/:itemId', userAuth, checkoutController.returnProduct);
router.get('/download-invoice/:orderId', userAuth, checkoutController.downloadInvoice);

//coupon  ==========================================
router.get('/get-active-coupons', userAuth, couponController.getActiveCoupons);
router.post('/apply-coupon', userAuth, couponController.applyCoupon);
router.delete('/remove-coupon', userAuth, couponController.removeCoupon);
router.get('/thank-you', userAuth, checkoutController.loadThankYouPage);

// Wishlist Routes
router.get('/wishlist', userAuth, wishlistController.loadWishlist);
router.post('/add-to-wishlist', userAuth, wishlistController.addToWishlist);
router.post('/remove-from-wishlist', userAuth, wishlistController.removeFromWishlist);
router.post('/check-wishlist', userAuth, wishlistController.checkWishlist);

module.exports = router
