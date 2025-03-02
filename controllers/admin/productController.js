const Product =require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const User=require("../../models/userSchema")
const fs=require("fs")
const path=require("path")
const sharp=require("sharp")
const { console } = require("inspector")




const getProductAddPage=async(req,res)=>{
    try {
        const category=await Category.find({isListed:true})
        res.render("product-add",{
            cat:category,
        })
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const addProducts=async (req,res)=>{
    try {
        console.log("going to add project");
        
        const products=req.body
        const productExists= await Product.findOne({
            productName:products.productName,
        })
        
        if(!productExists){
            console.log("if no project");
            
            const images=[]

            if(req.files&& req.files.length>0){
                for(let i=0;i<req.files.length;i++){
                    const orginalImagePath=req.files[i].path
                    const resizedFilename = `resized_${Date.now()}_${req.files[i].filename}`;
                    const resizedImagePath=path.join('public','uploads','product-images',resizedFilename)
                    await sharp(orginalImagePath).resize({width:440,height:440}).toFile(resizedImagePath)
                    images.push(req.files[i].filename)
                }
            }
            const categoryId=await Category.findOne({name:products.category})
            if(!categoryId){
                return res.status(400).join("Invalid category name")
            }

            const newProduct= new Product({
                productName:products.productName,
                description:products.description,
                brand:products.brand,
                category:categoryId._id,
                regularPrice:products.regularPrice,
                salePrice:products.quantity,
                size:products.size,
                color:products.color,
                productImage:images,
                status:'Available',
            })
            await newProduct.save()
            return res.redirect("/admin/addProducts")
        }else{
            return res.status(400).json("Product already exist , please try with another name")
        }
    } catch (error) {
        console.error("Error saving products ",error);
        return res .redirect("/admin/pageerror")
        
    }
}

const getAllProducts=async (req,res)=>{
    console.log('getallprodut listing')
try {
    console.log('show products');
    
    const search=req.query.search||""
    const page=req.query.page||1
    const limit=4

    const productData=await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i" )}}
        ]
    }).limit(limit*1).skip((page-1)*limit).populate('category').exec()
console.log("product in getallproduct",productData)
    const count= await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i" )}}
        ],

    }).countDocuments()

    const category=await Category.find({isListed:true})
    console.log("category from getallprodut",category)

    if(category){
        res.render("products",{
            data:productData,
            currentPage:page,
            totalPages:page,
            totalPages:Math.ceil(count/limit),
            cat:category
        })
    }else{
        res.render("/admin/pageerror")

    }

} catch (error) {
    res.redirect("/admin/pageerror")
}
}

const blockProduct=async(req,res)=>{
    try {
        let id =req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        
        res.redirect("/admin/products")
    } catch (error) {
        console.log(error);
        
        res.redirect("/admin/pageerror")
    }
}

const unblockProduct= async(req,res)=>{
    try {
        let id= req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})

        res.redirect("/admin/products")
    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror")
    }
}


module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct
}