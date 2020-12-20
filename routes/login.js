const express=require("express")

const router=express.Router()

router.get('/prod',(req,res,next)=>{
    console.log("in prod")
    console.log(req.session)
    res.send("<h1>hello from prod</h1>")
})


module.exports=router