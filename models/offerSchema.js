const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ["product", "category"],
        required: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "amount"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: function () {
            return this.type === "product";
        }
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: function () {
            return this.type === "category";
        }
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: Boolean,
        default: true
    },
    maxUses: {
        type: Number,
        default: 0 // 0 means unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Validate that endDate is after startDate
offerSchema.pre("validate", function (next) {
    if (this.endDate <= this.startDate) {
        next(new Error("End date must be after start date"));
    }
    next();
});

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;