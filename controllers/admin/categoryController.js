const Category = require('../../models/categorySchema.js');//iporting catschema

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

        const categoryData = await Category.find(query)
            .sort({createdAt: -1})
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

        const existingCategory = await Category.findOne({ name: name });
        if (existingCategory) {
            return res.status(400).json({error: "Category already exists"});
        }
        
        const newCategory = new Category({
            name,
            description,
        });
        
        await newCategory.save();
        return res.status(200).json({message: "Category added successfully"});
    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(500).json({error: "Internal Server error"});
    }
};

const listCategory = async(req, res) => {
    try {
        const categoryId = req.params.id;
        await Category.findByIdAndUpdate(categoryId, { isListed: true });
        res.redirect('/admin/category');
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

const unlistCategory = async(req, res) => {
    try {
        const categoryId = req.params.id;
        await Category.findByIdAndUpdate(categoryId, { isListed: false });
        res.redirect('/admin/category');
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
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
        const existingCategory = await Category.findOne({ 
            name: name, 
            _id: { $ne: categoryId } 
        });
        
        if (existingCategory) {
            return res.status(400).json({ error: "Category name already exists" });
        }
        
        await Category.findByIdAndUpdate(categoryId, {
            name,
            description
        });
        
        return res.status(200).json({ message: "Category updated successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const deleteCategory = async(req, res) => {
    try {
        const categoryId = req.params.id;
        await Category.findByIdAndDelete(categoryId);
        return res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const addCategoryOffer = async(req, res) => {
    try {
        const categoryId = req.params.id;
        const { offerPercentage } = req.body;
        
        if (isNaN(offerPercentage) || offerPercentage < 0 || offerPercentage > 100) {
            return res.status(400).json({ error: "Invalid offer percentage" });
        }
        
        await Category.findByIdAndUpdate(categoryId, {
            categoryOffer: offerPercentage
        });
        
        return res.status(200).json({ message: "Offer added successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const removeCategoryOffer = async(req, res) => {
    try {
        const categoryId = req.params.id;
        await Category.findByIdAndUpdate(categoryId, {
            categoryOffer: 0
        });
        
        return res.status(200).json({ message: "Offer removed successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    listCategory,
    unlistCategory,
    getEditCategory,
    updateCategory,
    deleteCategory,
    addCategoryOffer,
    removeCategoryOffer
};