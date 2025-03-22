const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const { console } = require("inspector")
const { log } = require("console")

const getProductAddPage = async(req, res) => {
    try {
        const category = await Category.find({isListed: true})
        res.render("product-add", {
            cat: category,
        })
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const addProducts = async (req, res) => {
    try {
        console.log("going to add product");
        
        const products = req.body
        console.log(products);
        
        const productExists = await Product.findOne({
            productName: products.productName,
        })
        
        if(!productExists){
            console.log("if no product exists");
            
            const images = []

            if(req.files && req.files.length > 0){
                for(let i = 0; i < req.files.length; i++){
                    const orginalImagePath = req.files[i].path
                    const resizedFilename = `resized_${Date.now()}_${req.files[i].filename}`;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFilename)
                    await sharp(orginalImagePath).resize({width: 440, height: 440}).toFile(resizedImagePath)
                    images.push(req.files[i].filename)
                }
            }
            
            const categoryId = await Category.findOne({name: products.category})
            if(!categoryId){
                return res.status(400).json("Invalid category name")
            }

            // Parse variants from form
            const sizes = Array.isArray(products.size) ? products.size : [products.size]
            const quantities = Array.isArray(products.quantity) ? products.quantity : [products.quantity]
            
            // Create variants array
            const variants = []
            let totalStock = 0
            
            for(let i = 0; i < sizes.length; i++) {
                const qty = parseInt(quantities[i] || 0)
                if(sizes[i] && qty > 0) {
                    variants.push({
                        size: sizes[i],
                        quantity: qty
                    })
                    totalStock += qty
                }
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                productImage: images,
                status: totalStock > 0 ? 'Available' : 'Out of stock',
                variants: variants,
                totalStock: totalStock
            })
            
            console.log("this newproduct", newProduct);
            
            await newProduct.save()
            return res.redirect("/admin/addProducts")
        } else {
            return res.status(400).json("Product already exists, please try with another name")
        }
    } catch (error) {
        console.error("Error saving products ", error);
        return res.redirect("/admin/pageerror")
    }
}

const getAllProducts = async (req, res) => {
    console.log('getallproduct listing')
    try {
        console.log('show products');
        
        const search = req.query.search || ""
        const page = req.query.page || 1
        const limit = 4

        
        const productData = await Product.find({
            $or: [
                {productName: {$regex: new RegExp(".*"+search+".*", "i")}}
            ]
        }).limit(limit*1).skip((page-1)*limit).populate('category').exec()
        
        console.log("product in getallproduct", productData)
        
        const count = await Product.find({
            $or: [
                {productName: {$regex: new RegExp(".*"+search+".*", "i")}}
            ],
        }).countDocuments()

        const category = await Category.find({isListed: true})
        console.log("category from getallproduct", category)

        if(category){
            res.render("products", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count/limit),
                cat: category
            })
        } else {
            res.redirect("/admin/pageerror")
        }
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const blockProduct = async(req, res) => {
    try {
        const productId = req.params.id;
        await Product.updateOne({_id: productId}, {$set: {isBlocked: true}});        
        res.status(200).json({message: "Product blocked successfully"})
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "An error occurred", error});
    }
}

const unblockProduct = async(req, res) => {
    try {
        const productId = req.params.id;
        await Product.updateOne({_id: productId}, {$set: {isBlocked: false}})
        res.status(200).json({message: "Product unblocked successfully"})
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "An error occurred", error});
    }
}

const getEditProduct = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        const category = await Category.find({});
        return res.render("edit-product", {
            product: product,
            cat: category,
        })
    } catch (error) {
        console.log("the error happens in geteditproduct")
        console.error(error.message)
        return res.redirect("/admin/pageerror")
    }
}

const editProduct = async(req, res) => {
    try {
        const productId = req.params.id;
        console.log("productId", productId)
        const productData = req.body;
        console.log("productData", productData)
         
        // Check for existing product with same name
        const existingProduct = await Product.findOne({
            productName: productData.productName,
            _id: { $ne: productId }
        });
         
        if (existingProduct) {
            return res.status(400).render("edit-product", {
                error: "Product with this name already exists",
                product: await Product.findById(productId),
                cat: await Category.find({})
            });
        }
         
        // Process new images=============
        const newImages = req.files
            ? req.files.map(file => file.filename)
            : [];
        
        // Parse variants from form========
        const sizes = Array.isArray(productData.size) ? productData.size : [productData.size]
        const quantities = Array.isArray(productData.quantity) ? productData.quantity : [productData.quantity]
        
        // Create variants array=========
        const variants = []
        let totalStock = 0
        
        for(let i = 0; i < sizes.length; i++) {
            const qty = parseInt(quantities[i] || 0)
            if(sizes[i] && qty > 0) {
                variants.push({
                    size: sizes[i],
                    quantity: qty
                })
                totalStock += qty
            }
        }
         
        // Prepare update fields
        const updateFields = {
            productName: productData.productName,
            description: productData.description,
            category: productData.category,
            regularPrice: productData.regularPrice,
            salePrice: productData.salePrice,
            variants: variants,
            totalStock: totalStock,
            status: totalStock > 0 ? 'Available' : 'Out of stock'
        };

        // Add new images if any
        if (newImages.length > 0) {
            updateFields.$push = { productImage: { $each: newImages } };
        }
         
        console.log("updateFields", updateFields)
        
        // Correctly use productId for update
        const updatedProduct = await Product.findByIdAndUpdate(productId, updateFields, { new: true });
        
        if (!updatedProduct) {
            console.log("Product not found");
            return res.redirect("/admin/pageerror");
        }
        
        return res.redirect("/admin/products");
    } catch (error) {
        console.log("error found in edit product", error);
        console.log("Full error details:", error.message, error.stack);
        
        // Render error page with more context
        return res.status(500).render("admin-error", { 
            message: "Failed to update product",
            error: error.message
        });
    }
}

const deleteSingleImage = async (req, res) => {
    console.log("🔥 DELETE request received with:", req.body); // Debugging
    try {
        const { imageNameToServer, productIdToServer } = req.body;
        console.log("🖼 Image:", imageNameToServer, "🆔 Product ID:", productIdToServer);

        const product = await Product.findByIdAndUpdate(productIdToServer, { 
            $pull: { productImage: imageNameToServer } 
        });

        if (!product) {
            console.error("🚨 Product not found!");
            return res.json({ status: false, message: "Product not found" });
        }

        const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log("✅ Image deleted successfully!");
        } else {
            console.warn("⚠️ Image file not found!");
        }

        return res.json({ status: true });

    } catch (error) {
        console.error("❌ Error:", error);
        return res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

// Additional functions for managing product stock

const updateProductStock = async (req, res) => {
    try {
        const { productId, variants } = req.body;
        
        // Calculate total stock
        let totalStock = 0;
        for (const variant of variants) {
            totalStock += parseInt(variant.quantity);
        }
        
        // Update product with new variants and total stock
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { 
                variants: variants,
                totalStock: totalStock,
                status: totalStock > 0 ? 'Available' : 'Out of stock'
            },
            { new: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }
        
        return res.json({ 
            status: true, 
            message: "Stock updated successfully", 
            product: updatedProduct 
        });
    } catch (error) {
        console.error("Error updating stock:", error);
        return res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    updateProductStock
}