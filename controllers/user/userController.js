const User = require('../../models/userSchema')
const env = require("dotenv").config();
const nodemailer = require("nodemailer")
const bcrypt=require("bcrypt")


const pageNotFound = async (req, res) => {
    try {
        res.render("pageNotFound")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const loadHomepage = async (req, res) => {
    try {
        let user = null;
        if (req.session.user_id) {
            user = await User.findById(req.session.user_id).lean();
        }
        res.render('home', { user });
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};



const loadShopping = async (req, res) => {
    try {
        return res.render("shop")
    } catch (error) {
        console.log('home page not loading :', error);
        res.status(500).send('server error')

    }
}


const loadSignup = async (req, res) => {
    console.log('loaded signup');
    try {
        return res.render('signup')

    } catch (error) {
        console.log('home page not loading :', error);
        res.status(500).send('server error')
    }
}


function generateOtp() {
    console.log('at otp makin');
    return Math.floor(100000 + Math.random() * 900000).toString();
}


async function sendVerificationEmail(email, otp) {
    console.log("inside verification fucntion");
    try{
        console.log('sending verification email');
        const transporter = nodemailer.createTransport({ //here using nodemailer lib we created a email transporter 
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        console.log('waiting for sendMail work');     
        const info = await transporter.sendMail(
            {//sendMail fucntion sends the actual mail
                from: process.env.NODEMAILER_EMAIL,
                to: email,
                subject: "verify your account",
                text: `Your OTP is ${otp}`,
                html: `<b>Your OTP:${otp}</b>`
            })
        console.log("sendMail done");
        return info.accepted.length > 0
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}



console.log("just bfr enter to post signup");
const signup = async (req, res) => {
    console.log("enter to post signup");
    try {
        const{name,phone,password,cPassword,email}=req.body;


        //checking password
        console.log('checkpass');
        if (password !== cPassword) {
            return res.render("signup", { message: "Password do not match" })
        }


        const findUser = await User.findOne({ email })//searching for email in schema
        console.log('findusert',findUser);
        console.log('checkmail');
        if (findUser) {
            return res.render("home", { message: "User with this email is exists" })
        }


        console.log('otp generating function is calling');
        const otp = generateOtp();//storing the returned otp from the function
        

        console.log("waiting sendVerificationEmail");        
        const emailSent = await sendVerificationEmail(email, otp);


        if (!emailSent) {
            return res.json("email-error")
        }


        req.session.userOtp = otp;
        req.session.userData = {name,phone, email, password }


        res.render("verify-otp")
        console.log("OTP Sent", otp);


    } catch (error) {
        console.error('sign error', error)
        res.redirect("/pageNotFound")
    }
}


const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)

        return passwordHash;
    } catch (error) {
        
    }
}


const verifyOtp=async(req,res)=>{
    try {
        const{otp}=req.body;
        console.log(otp);

        if(otp===req.session.userOtp){
            const user=req.session.userData
            const passwordHash=await securePassword(user.password)

            const saveUserData=new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,

            })

            await saveUserData.save();
            req.session.user=saveUserData._id;
            res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP , Please try again"})
        }
        
    } catch (error) {
        console.error("Error Verifying OTP",error)
        res.status(500).json({success:false,message:"An error occured"})
    }
}

const resendOtp=async (req,res)=>{
    try {
        const {email}=req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp =generateOtp();
        req.session.userOtp=otp;

        const emailSent=await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("Resend OTP",otp);
            res.status(200).json({success:true,message:"OTP send successfully"})

        }else{
            res.status(500).json({success:false,message:"Failed tio resend the OTP. Please try again"})
        }
        }catch (error) {
        console.error("Error resending OTP",error)
        res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
    }
}



const loadLogin=async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.render("login", { message: "Invalid email or password" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.render("login", { message: "Invalid email or password" });
        }

        if (user.isBlocked) {
            return res.render("login", { message: "Your account is blocked" });
        }

        // Store user in session
        req.session.user_id = user._id;

        res.redirect("/");
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};

const logout = (req, res) => {
  try{  req.session.destroy((err) => {
        if (err) {
            console.log(err);
            return res.status(500).send("Logout failed");
        }
        return res.redirect("/login");
    });
}catch(error){
    console.log('logout error',error);
    res.redirect("/pageNotFound")
    
    }
};

const loadProfile = async (req, res) => {
    try {
        if (!req.session.user_id) {
            return res.redirect("/login");
        }
        const user = await User.findById(req.session.user_id).lean();
        res.render("profile", { user });
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};


module.exports = {
    loadHomepage,
    pageNotFound,
    loadShopping,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    loadProfile,
    logout
}