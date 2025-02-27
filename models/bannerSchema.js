const mongoose=require("mongoose")
const{Schema}=mongoose

const bannerSchema=new Schema({
    image:{
        type:String,
        required:true
    },
    title:{
        type:String,
        requiered:true
    },
    description:{
        type:String,
        requiered:true
    },
    Link:{
        type:String
    },
    startDate:{
        type:Date,
        requiered:true
    },
    endDate:{
        type:Date,
        requiered:true
    }
})


const Banner=mongoose.model('Banner',bannerSchema)
module.exports=Banner