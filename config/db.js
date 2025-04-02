const mongoose=require("mongoose")
const env=require("dotenv").config()
const connectDB= async()=>{
    try{
      const conn =  await mongoose.connect(process.env.MONGODB_URI)
      console.log("hostname",conn.connection.host)
      console.log("dbname",conn.connection.name)
        console.log('db connected');
        
    }catch(error){
        
        console.log('db connection error',error.message);
        process.exit(1)
    }
}

module.exports=connectDB