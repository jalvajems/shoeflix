const mongoose=require("mongoose")
const { join } = require("path")
const {Schema}=mongoose

const cartSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    items:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:'Product',
            required:true
        },
        quantity:{
            type:Number,
            default:1
        },size: {
            type: String,
            enum: ['IND-5', 'IND-6', 'IND-7', 'IND-8'],
            // required: true
        },price:{
            type:Number,
            required:true
        },
        totalPrice:{
            type:Number,
            require:true
        },
        status:{
            type:String,
            default:'placed'
        },
        cancellationReason:{
            type:String,
            default:'none'
        },addedOn: { 
            type: Date,
            default: Date.now
        }
    }]
})

const Cart=mongoose.model("Cart",cartSchema)
module.exports=Cart