const mongoose=require("mongoose");
const { type } = require("os");
const {Schema}=mongoose;


const productSchema=new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true,
    },
    brand:{
        type:String,
        required:true,
    },
    category:{
        type:Schema.Types.ObjectId,
        
    },regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:true
    },
    color:{
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBooked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","Out of stock","Discountinued"],
        required:true,
        default:"Available"
    },
},{timestamps:true})

const Product=mongoose.model("Product",productSchema)
module.exports=Product