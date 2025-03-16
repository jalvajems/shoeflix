const mongoose=require("mongoose")
const { type } = require("os")
const { boolean } = require("webidl-conversions")
const { search } = require("../app")
const {Schema}=mongoose


const userSchema=new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,                                                                                                                                                                  
        default:null
    },
    googleId:{
        type:String,
        unique:true,
    },

    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart",                           
    }],  
    wallet: {
        type: Number,
        default: 0
    },
    walletHistory: [{
        transactionId: String,
        date: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ["credit", "debit"],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["Completed", "Pending"],
            default: "Completed"
        }
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:String
    },
    redeemed:{
        type:Boolean
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
})

const User=mongoose.model("User",userSchema);
module.exports=User