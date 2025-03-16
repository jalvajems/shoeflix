const User=require("../../models/userSchema")
const Address=require("../../models/addressSchema")
const Order=require("../../models/orderSchema")
const nodemailer=require("nodemailer")
const bcrypt=require("bcrypt")
const env=require("dotenv").config()
const session=require("express-session")
const { text } = require("express")
const { read } = require("fs")




//password resetting===============================================================

function generateOtp(){
    console.log('creating otp');
    
    const digits="1234567890"
    let otp=""
    for(let i =0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp
}
const sendVerificationEmail = async (email, otp) => {
    console.log('reached at forgot email varification');
    
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP:${otp}</h4><br></b>`
        }
        const info = await transporter.sendMail(mailOptions);

        return true

    } catch (error) {
        console.error("error sending email", error);
        return false
    }
}

const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;

    } catch (error) {

    }
}

const getForgotPassPage = async (req, res) => {
    try {
        console.log("reaching getforgot password");
        
        res.render("forgot-password");

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid=async(req,res)=>{
    try {
        console.log('reached at forgot email valid');
        
        const{email}=req.body
        const findUser=await User.findOne({email:email})
        if(findUser){
            console.log('otp creating');
            
            const otp=generateOtp()
            const emailSent=await sendVerificationEmail(email,otp)
            if(emailSent){
                req.session.userOtp=otp
                req.session.email=email
                res.render("forgotPass-otp")
                console.log("OTP:",otp);
                
            }else{
                console.log('cant sent otp ');
                
                res.json({success:false,message:"Failed to sent the OTP. Please try  again"})
            }
        }else{
            console.log('rendering forgot password')
            res.render("forgot-password",{
                message:"User with this email does not exist!"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const verifyForgotPassOtp = async (req, res) => {
console.log('verifying forgot  passwor.......');

    try {

        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            return res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: "An error occured. Please try again" })
    }
}



const getResetPassPage = async (req, res) => {
  console.log('reached at get reset passpage');
  
    try {
         return res.render("reset-password")

    } catch (error) {

        return res.redirect("/pageNotFound")
    }
}


const resendOtp = async (req, res) => {
    console.log("reached resend otp");
    
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("resend  otp",otp);
            return res.status(200).json({ success: true, message: "OTP resend successfully" });
        }
         else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
        }
        
    } catch (error) {
        
        console.error("Error in resend otp", error)
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}


const postNewPassword = async (req, res) => {
    console.log('postnewpassword......');
    
    try {

        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email }, { $set: { password: passwordHash } }
            )
            return res.redirect("/login")
        } else {
            return res.render("reset-password", { message: 'Passwords do not match' });
        }

    } catch (error) {
        console.error('error---------',error);
        
        return res.redirect("/PageNotFound")
    }
}
const loadUserProfile = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = await User.findById(userId);
      const addressData = await Address.findOne({ userId: userId });
  
      // Fetch orders with detailed population and pagination
      const page = parseInt(req.query.page) || 1;
      const limit = 5; // Adjust as needed
      const skip = (page - 1) * limit;
      const orders = await Order.find({ userId })
        .populate({
          path: 'orderItems.product',
          select: 'productName productImage' // Fetch product name and images
        })
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Map order items to include product details
      orders.forEach(order => {
        order.orderItems = order.orderItems.map(item => ({
          ...item,
          name: item.product ? item.product.productName : 'Unknown Product',
          productImage: item.product && item.product.productImage ? item.product.productImage[0] : '/public/uploads/product-images/default.jpg'
        }));
      });
  
      const totalOrders = await Order.countDocuments({ userId });
      const totalPages = Math.ceil(totalOrders / limit);
  
      res.render('profile', {
        user: userData,
        userAddress: addressData,
        orders,
        currentPage: page,
        totalPages
      });
    } catch (error) {
      console.error("error for retrieve profile data", error);
      res.redirect("/pageNotFound");
    }
  };
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user
        const { username, mobile } = req.body
        
  
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username, mobile },
            { new: true }
        )
  
        
  
        if (!updatedUser) {
            return res.status(200).json({
                success: false,
                message: 'User not found'
            });
        }
  
        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
  });
  }
  }


//change email==========================================================
const changeEmail=async(req,res)=>{
    try {
        console.log("reached email changing page");        
        res.render("change-email")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}
const changeEmailValid=async(req,res)=>{
    try {
        console.log("changing the email");
        const {email}=req.body
        const userExists=await User.findOne({email})
        if(userExists){
            const otp=generateOtp()
            const emailSent=await sendVerificationEmail(email,otp)
            if(emailSent){
                req.session.userOtp=otp;
                req.session.userData=req.body;
                req.session.email=email;
                res.render("change-email-otp")
                console.log("Email sent:",email);
                console.log("OTP",otp);
                
                
            }else{
                res.json("email-error")
            }
        }else{
            res.render("change-email",{
                message:"user with this email is not exist"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const verifyEmailOtp = async (req, res) => {
    try {
        console.log("verifying email otp");
        
        const enteredOtp = req.body.otp;
        if (!enteredOtp || !req.session.userOtp) {
            return res.json({
                success: false,
                message: "Invalid OTP verification attempt"
            });
        }

        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            return res.json({
                success: true,
                redirectUrl: "/update-email"
            });
        } else {
            return res.json({
                success: false,
                message: "The OTP you entered is incorrect. Please try again."
            });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.json({
            success: false,
            message: "An error occurred during verification. Please try again."
        });
    }
}

const getUpdateEmailPage=async(req,res)=>{
    try {
        if(!req.session.userOtp){
            return res.redirect("/change-email")
        }
        return res.render('update-email',{message:null})
    } catch (error) {
        console.error("Error loading update email page:", error);
    return res.redirect("/pageNotFound")        
    }
}
const updateEmail = async (req, res) => {
    try {

        const newEmail = req.body.email;
        const userId = req.session.user;

        const emailExists = await User.findOne({ email: newEmail, _id: { $ne: userId } });

        if (emailExists) {
            return res.render("update-email", { message: "This email already exists. Please try again with a new email." });
        }

        await User.findByIdAndUpdate(userId, { email: newEmail });
        return res.redirect("/userProfile?tab=dashboard")

    } catch (error) {
        console.error("The error is here", error)
        return res.redirect("/pageNotFound")
    }
}

const changePassword = async (req, res) => {
    try {

        return res.render("change-password")

    } catch (error) {

        return res.redirect("/pageNotFound")

    }
}

const changePasswordValid = async (req, res) => {
    try {

        const { email } = req.body;
        const userId = req.session.user

        const currentUser = await User.findOne({ _id: userId })

        if (!currentUser) {
            return res.render("change-password", { message: "User not exist with this email" })
        }

        if (currentUser.email !== email) {
            return res.render("change-password", { message: "Please enter current email" })
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            req.session.userOtp = otp;
            req.session.userData = req.body;
            req.session.email = email;

            console.log("OTP:", otp)
            return res.render("change-password-otp");
        } else {
            return res.json({
                success: false,
                message: "Failed to send OTP. Please try again"
            })
        }

    } catch (error) {

        console.error("Error in change password validation", error);
        return res.redirect("/pageNotFound")
    }
}

const verifyChangePassOtp = (req, res) => {
    try {

        const enteredOtp = req.body.otp;

        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            return res.json({
                success: true,
                redirectUrl: "/reset-password"
            });
        } else {
            return res.json({
                success: false,
                message: "The OTP you entered is incorrect. Please try again."
            });
        }

    } catch (error) {

        return res.json({
            success: false,
            message: "An error occurred during verification. Please try again."
        });

    }
}
//address===============================================================


const addAddress = async (req, res) => {
    try {

        const user = req.session.user;
        return res.render("add-address", { user: user })

    } catch (error) {
        return res.redirect("pageNotFound")
    }
}


const postAddAddress = async (req, res) => {
    try {

        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            })
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        return res.redirect("/userProfile?tab=address")
    } catch (error) {
        console.error("Error adding address:", error)
        return res.redirect("/pageNotFound")
    }
}

const editAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id": addressId,
        });
        if (!currAddress) {
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();
        })

        if (!addressData) {
            return res.redirect("/pageNotFound")
        }


        return res.render("edit-address", { address: addressData, user: user });

    } catch (error) {
        console.log("Error in edit address", error)
        return res.redirect("/pageNotFound")
    }
}


const postEditAddress = async (req, res) => {
    try {

        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.redirect("/pageNotFound")
        }
        await Address.updateOne({ "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        addressType: data.addressType,
                        name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        pincode: data.pincode,
                        state: data.state,
                        phone: data.phone,
                        altPhone: data.altPhone,
                    }
                }

            }
        )

        return res.redirect("/userProfile?tab=address")

    } catch (error) {
        console.error("Error in edit address", error);
        res.redirect("/pageNotFound")
    }
}
const deleteAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send("Address not found")
        }

        await Address.updateOne({
            "address._id": addressId
        },
            {
                $pull: {
                    address: {
                        _id: addressId,
                    }
                }
            })

            res.redirect("/userProfile")
    } catch (error) {
        console.error("Error in delete address:", error);
        return res.redirect("/pageNotFound")
    }
}



module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile: loadUserProfile,
    updateProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    getUpdateEmailPage,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress
  };