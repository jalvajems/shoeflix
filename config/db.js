const mongoose=require("mongoose")
const env=require("dotenv").config()
const connectDB= async()=>{
    try{
      const conn =  await mongoose.connect(process.env.MONGODB_URI)
      console.log("hostname",conn.connection.host)
      console.log("dbname",conn.connection.name)
        console.log('db connected');
        
        try {
            const User = require("../models/userSchema");
            await User.collection.dropIndex("googleId_1");
            console.log("Dropped old non-sparse googleId_1 index successfully");
        } catch (err) {
            // Index doesn't exist or already dropped, ignore
        }
        
    }catch(error){
        
        console.log('db connection error',error.message);
        process.exit(1)
    }
}

module.exports=connectDB