const express=require("express")

const router=express.Router()

router.get('/',(req,res,next)=>{
    req.session.isLoggedIn="True"
    console.log("in another")
    res.send("<h1>hello</h1>")
})


module.exports=router