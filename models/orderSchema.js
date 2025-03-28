const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');
const Address = require("./addressSchema");

const orderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    orderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variants: {
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
        },
        price: {
            type: Number,
            default: 0
        },
        name: {
            type: String,
            required: false
        },
        returnStatus: {
            type: String,
            enum: ['Not Requested', 'Requested', 'Approved', 'Rejected'],
            default: 'Not Requested'
        },
        cancelStatus: {
            type: String,
            enum: ['completed', 'Cancelled'],
            default: 'completed'
        },
        returnReason: { 
            type: String
        },
        returnRequestedAt: {
            type: Date
        },
        productImage: {
            type: [String],
            required: true
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    offerDiscount: {
        type: Number,
        default: 0
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: [{
        addressType: { type: String, required: true },
        name: { type: String, required: true },
        city: { type: String, required: true },
        landMark: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: Number, required: true },
        phone: { type: String, required: true },
        altPhone: { type: String, required: true }
    }],
    paymentMethod: {
        type: String,
        required: true, 
        enum: ['COD', 'Razorpay', 'wallet'] 
    },
    paymentDetails: { 
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String,
        attempts: [{
            razorpayOrderId: String,
            razorpayPaymentId: String,
            failureReason: String,
            attemptedAt: Date
        }],
        status: { type: String, enum: ['Pending', 'Success', 'Failed'], default: 'Pending' }
    },
    invoiceDate: {
        type: Date // Corrected from "Date" to Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned', 'Cancellation Requested'] // Added 'Cancellation Requested'
    },
    cancellationReason: { 
        type: String,
        default: ''
    },
    cancellationRequestedAt: {
        type: Date
    },
    cancellationApprovedAt: { 
        type: Date 
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    couponCode: {
        type: String,
        default: null
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;