const Category=require('../../models/categorySchema.js')


const categoryInfo=async(req,res)=>{
    try {
        console.log("reaching cat info")
        const page=parseInt(req.query.page)||1;
        const limit=4;
        const skip=(page-1)*limit

        const categoryData=await Category.find({})
        
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCategories=await Category.countDocuments();
        const totalPages=Math.ceil(totalCategories/limit);
        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories
        })
    } catch (error) {
        console.error(error)
        res.redirect("/admin/pageerror")
    }
}

const addCategory=async(req,res)=>{

    console.log("entering to addcation");
    
    const {name,description}=req.body;
    try {
        console.log("adding to catgry")

        const existingCategory=await Category.findOne({name})
        if(existingCategory){
            return res.status(400).json({error:"Category already existing"})
        }
        const newCategory=new Category({
            name,
            description,
        })
        await newCategory.save();
        return res.json({message:"Category added successfully"})
    } catch (error) {
        return res.status(500).json({error:"Internal Server error"})
    }
}

module.exports={

    categoryInfo,
    addCategory
}