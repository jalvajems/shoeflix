const mongoose = require("mongoose");
const { Schema } = mongoose;
const Category = require("./categorySchema");

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        required: true,
        default: "Available"
    },
    productOffer: {
        type: Number,
        default: 0
    },
    averageRating: { 
        type: Number,
        default: 0
    }, 
    ratingCount:
    { 
    type: Number,
    default: 0 
    },
    variants: [
        {
            size: {
                type: String,
                enum: ['IND-5', 'IND-6', 'IND-7', 'IND-8'],
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                min: 0
            }
        }
    ],
    totalStock: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;