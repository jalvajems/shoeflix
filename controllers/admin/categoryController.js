const MESSAGES = require('../../constants/messages');
const STATUS_CODES = require('../../constants/statusCodes');
const Category = require('../../models/categorySchema');

const categoryInfo = async(req, res) => {
    try {
        console.log("reaching category info")
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }

        const sortOption = req.query.sort === 'oldest' ? 1 : -1;

        const categoryData = await Category.find(query)
            .sort({createdAt: sortOption})
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);
        
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};
const addCategory = async(req, res) => {
    console.log("entering to addCategory");
    console.log(req.body);
    
    const { name, description } = req.body;
    try {
        console.log("adding to category");

        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") }  });
        if (existingCategory) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({error: "Category already exists"});
        }
        
        const newCategory = new Category({
            name,
            description,
        });
        
        await newCategory.save();
        return res.status(STATUS_CODES.OK).json({message: "Category added successfully"});
    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({error:MESSAGES.INTERNAL_SERVER_ERROR});
    }
};

const listCategory = async(req, res) => {
    console.log("list reached here")
    try {
        let categoryId = req.params.id;
        console.log("categoryIdList", categoryId)
        await Category.updateOne({ _id: categoryId }, { $set: { isListed: true } });
        res.status(STATUS_CODES.OK).json({message:"Category listed successfully"})
    } catch (error) {
        console.error(error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message:MESSAGES.INTERNAL_SERVER_ERROR, error });
    }
};

const unlistCategory = async(req, res) => {
    console.log("unlisted reached here")
    try {
        const categoryId = req.params.id;
        console.log("categoryIdUnlist", categoryId)
        await Category.updateOne({ _id: categoryId }, { $set: { isListed: false } });
        res.status(STATUS_CODES.OK).json({message:"Category unlisted successfully"})
    } catch (error) {
        console.error(error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message:MESSAGES.INTERNAL_SERVER_ERROR, error });
    }
};


const getEditCategory = async(req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);
        
        if (!category) {
            return res.redirect('/admin/category');
        }
        
        res.render('editCategory', { category });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

const updateCategory = async(req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, description } = req.body;
        
        // Check if the updated name already exists for another category
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") }  });

        
        if (existingCategory) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ error: "Category name already exists" });
        }
        
        await Category.findByIdAndUpdate(categoryId, {
            name,
            description
        });
        
        return res.status(STATUS_CODES.OK).json({ message: "Category updated successfully" });
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: MESSAGES.INTERNAL_SERVER_ERROR });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    listCategory,
    unlistCategory,
    getEditCategory,
    updateCategory
};