const User=require("../models/userSchema")


const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                res.redirect("/admin/login")
            }
        })
        .catch(error=>{
            console.log("Error in user auth middlware");
            res.status(500).send("Internal Server error")
        })
    }else{
        res.redirect("/admin/login")
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