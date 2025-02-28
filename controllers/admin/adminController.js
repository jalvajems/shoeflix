const User=require("../../models/userSchema")
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")

const pageerror=async(req,res)=>{
    res.render("admin-error")
}


const loadLogin=(req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin-login",{message:null})
}

const login=async(req,res)=>{
    try{
    const {password,email}=req.body;
    const admin=await User.findOne({email,isAdmin:true});
    console.log(admin)
    if(admin){
        const passwordMatch=bcrypt.compare(password,admin.password)
        if(passwordMatch){
            console.log("reachjae")
            req.session.admin=true;
            return res.redirect("/admin/dashboard")
        }else{
            return res.redirect("/admin/login")
        }
    }else{
        return res.redirect("/admin/login")
    }
}catch(error){
    console.log("login error",error);
    return res.redirect('/pageerror')
    
}
}

const loadDashboard=async(req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            res.redirect("/pageerror")
        }
    }
}


module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror
}