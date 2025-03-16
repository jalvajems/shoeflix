const User=require("../../models/userSchema")



const customerInfo=async(req,res)=>{
    try {
        let search=""
        if(req.query.search){
            search=req.query.search
        }
        let page=1
        if(req.query.page){
            page=req.query.page
        }
        const limit=3
        const userData=await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
            ],
        })
        .limit((limit*1))
        .skip((page-1)*limit)
        .exec()
        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
            ],
        }).countDocuments();

        res.render('customers',{
            data:userData,
            totalPages:Math.ceil(count/limit),
            currentPage:page
        })
        
    } catch (error) {
        res.redirect("/pageerror")
    }
}


const customerBlocked = async (req, res) => {
    try {
      let id = req.params.id;
      await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
      res.status(200).json({ message: "User blocked successfully" });
    } catch (error) {
      res.status(500).json({ message: "An error occurred", error });
    }
  };
  

const customerUnBlocked = async (req, res) => {
    try {
      let id = req.params.id;
      await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
      res.status(200).json({ message: "User unblocked successfully" });
    } catch (error) {
      res.status(500).json({ message: "An error occurred", error });
    }
  };
  


module.exports={
    customerInfo,
    customerBlocked,
    customerUnBlocked,

}