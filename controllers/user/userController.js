const User = require('../../models/userSchema')
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
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
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });
        
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },quantity:{$gt:0}
        }).sort({ createdAt: -1 }).limit(4);
        
        
        if (user) {
            const userData = await User.findOne({ _id: user });
            
            if (userData.isBlocked) {
                req.session.destroy((err) => {
                    if (err) {
                        return res.status(500).send('Error in logging out');
                    }
                    res.redirect('/login');
                });
                return;
            }
            return res.render("home", { 
                user: userData,
                products: productData,
            });
        } else {
            return res.render("home", {
                products: productData,
            });
        }
    } catch (error) {
        console.log("Error loading homepage:", error);
        res.status(500).send("Server error");
    }
};
const loadShopping = async (req, res) => {
    try {
        const user = req.session.user;
        
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData && userData.isBlocked) {
                req.session.destroy((err) => {
                    if (err) {
                        console.log("Error destroying session:", err);
                    }
                    return res.redirect('/login');
                });
                return;
            }
        }
        
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id);
        console.log("Category IDs:", categoryIds);
        
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        
        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            totalStock: { $gt: 0 } 
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
        
       
        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryIds },
            totalStock: { $gt: 0 } 
        });
        
        const totalPages = Math.ceil(totalProducts / limit);
        
        console.log("Products found:", products.length);
        if (products.length > 0) {
            console.log("Sample product:", products[0]);
        }

      
        return res.render("shop", {
            user: userData,
            products: products,
            category: categories,
            currentPage: page,
            totalPages: totalPages
        });
        
    } catch (error) {
        console.log('Shop page not loading:', error);
        res.status(500).send('Server error');
    }
};

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
                googleId:user.email

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
            res.status(200).json({success:true,message:"OTP send successfullyjjjjjj"})

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
        // Store the email in session for later validation
        req.session.loginEmail = email;

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

        req.session.user = user._id;
        console.log("User logged in with ID:", user._id);
        
        req.session.isNewUser = false;
        
        req.session.save((err) => {
            if (err) {
                console.log("Session save error:", err);
                return res.status(500).send("Server Error");
            }
            return res.redirect("/");
        });
    } catch (error) {
        console.log("Login error:", error);
        res.status(500).send("Server Error");
    }
};
const logout = (req, res) => {
    try {
        delete req.session.user;
        res.redirect("/login");
    } catch (error) {
        console.log('logout error', error);
        res.redirect("/pageNotFound");
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

const getFilteredProducts = async (req) => {
    const categories = await Category.find({ isListed: true }).lean();
    const categoryIds = categories.map(category => category._id.toString());

    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || req.body.sort || 'default';

    req.session.sort = sort;

    // Basic query without sizeVariants
    const query = {
        isBlocked: false
    };

    // Apply category filter
    if (req.query.category) {
        req.session.selectedCategory = req.query.category;
    }

    if (req.session.selectedCategory) {
        query.category = req.session.selectedCategory;
    } else {
        query.category = { $in: categoryIds };
    }

    // Apply search filter
    if (req.body.query) {
        req.session.searchQuery = req.body.query;
    }
    
    if (req.session.searchQuery) {
        query.productName = { 
            $regex: new RegExp(req.session.searchQuery, "i") 
        };
    }

// Inside getFilteredProducts function
if (req.session.priceFilter && 
    req.session.priceFilter.gt !== undefined && 
    req.session.priceFilter.lt !== undefined) {
    
    const minPrice = Number(req.session.priceFilter.gt);
    const maxPrice = Number(req.session.priceFilter.lt);
    
    if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice <= maxPrice) {
        query.salePrice = {
            $gte: minPrice,
            $lte: maxPrice
        };
        console.log(`Applying price filter: ${minPrice} to ${maxPrice}`);
    } else {
        console.log("Invalid price range values:", req.session.priceFilter);
    }
}

    // Apply sorting
    let sortOption = {};
    switch (sort) {
        case "low":
            sortOption = { salePrice: 1 };
            break;
        case "high":
            sortOption = { salePrice: -1 };
            break;
        case "az":
            sortOption = { productName: 1 };
            break;
        case "za":
            sortOption = { productName: -1 };
            break;
        default:
            sortOption = { createdAt: -1 };
    }

    // Debug logs
    console.log("Filter query:", JSON.stringify(query, null, 2));
    console.log("Sort option:", sortOption);
    
    // Execute query
    const products = await Product.find(query)
        .collation({ locale: 'en', strength: 2 })
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate('category')
        .lean();
    
    // Check if we got any products
    console.log(`Query returned ${products.length} products`);
    
    // If no products found with price filter, log some data to diagnose
    if (products.length === 0 && query.salePrice) {
        const sampleProducts = await Product.find({
            isBlocked: false
        }).limit(5).select('productName salePrice').lean();
        
        console.log("Sample products and their prices:", sampleProducts);
    }

    const updatedProducts = products.map((product) => {
        const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;
        
        return {
            ...product,
            totalOffer
        };
    });

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    return {
        products: updatedProducts,
        totalProducts,
        totalPages,
        currentPage: page,
        categories,
        sort,
    };
};
const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const searchQuery = req.body.query || req.query.query; // Handle both POST and GET

        // Clear price filter if new category or search is applied
        if (req.query.category || searchQuery) {
            req.session.priceFilter = null;
        }

        // Set search query in session
        if (searchQuery) {
            req.session.searchQuery = searchQuery;
        } else {
            req.session.searchQuery = null; // Clear search if no query
        }

        const { 
            products, 
            totalPages, 
            currentPage, 
            categories, 
            sort 
        } = await getFilteredProducts(req);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData && (category || searchQuery)) {
                userData.searchHistory.push({
                    category: category || null,
                    searchQuery: searchQuery || null,
                    searchedOn: new Date()
                });
                await userData.save();
            }
        }

        return res.render("shop", {
            user: userData,
            products,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: req.session.selectedCategory || null,
            selectedSort: sort,
            priceRange: req.session.priceFilter || null,
            searchQuery: req.session.searchQuery || null
        });
    } catch (error) {
        console.error(error);
        return res.redirect("/pageNotFound");
    }
};
const filterByPrice = async (req, res) => {
    try {
        // Parse query parameters and ensure they're numbers
        const gt = parseInt(req.query.gt) || 0;
        const lt = parseInt(req.query.lt) || Number.MAX_SAFE_INTEGER;

        // Store price filter in session
        req.session.priceFilter = { gt, lt };

        console.log(`Price filter applied: ${gt} to ${lt}`);

        const { 
            products, 
            totalPages, 
            currentPage, 
            categories, 
            sort 
        } = await getFilteredProducts(req);

        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        // Log some sample products for debugging
        if (products.length === 0) {
            const sampleProducts = await Product.find({
                isBlocked: false
            }).limit(5).select('productName salePrice').lean();
            console.log("No products found. Sample products:", sampleProducts);
        }

        return res.render("shop", {
            user: userData,
            products,
            category: categories,
            totalPages,
            currentPage,
            selectedSort: sort,
            selectedCategory: req.session.selectedCategory || null,
            searchQuery: req.session.searchQuery || null,
            priceRange: { gt, lt }
        });
    } catch (error) {
        console.error("Error in filterByPrice:", error);
        return res.redirect("/pageNotFound");
    }
};

module.exports = {
    loadHomepage,
    loadShopping,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    loadProfile,
    logout,
    filterProduct,
    filterByPrice
}