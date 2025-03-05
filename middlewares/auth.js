const User=require("../models/userSchema")


const userAuth = async (req, res, next) => {
    try {
      if (req.session.user) {
        const userData = await User.findById(req.session.user) 
        
        if (!userData || userData.isBlocked) {
          req.session.destroy((err) => {
            if (err) {
              return res.status(500).send("Error destroying session")
            }
            return res.redirect('/login')
          });
        } else {
          return next()
        }
      } else {
        return res.redirect('/login')
      }
    } catch (err) {
      console.error("User authentication error:", err)
      return res.status(500).send("Internal Server Error")
    }
  }
  
const adminAuth=(req,res,next)=>{
if(req.session.admin){
    next()
}else{
    res.redirect("/admin/login")
}
}
module.exports={
    userAuth,
    adminAuth
}