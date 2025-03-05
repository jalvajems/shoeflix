const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");


const productDetails = async (req,res) => {
    try {
        
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.params.id;

        if (!productId) {
          return res.redirect("/pageNotFound");
      }
        const product = await Product.findById(productId).populate('category');
        const findCategory = product.category;
        const relatedProduct = await Product.find({category:findCategory,_id:{$ne:productId}}).sort({ createdAt: -1 }).limit(4)
        return res.render("product-details",{
            user:userData,
            product:product,
            category:findCategory,
            relatedProduct
        })

    } catch (error) {
      
        console.log("Error for fetching product details",error)
      return res.redirect("/pageNotFound")
    }
}

module.exports = {
    productDetails
}
