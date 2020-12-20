
// const express=require("express")
// const app=express();

// const session=require("express-session")
// // const MongoClient = require('mongodb').MongoClient;
// const uri = "mongodb+srv://Abhishek:Baba@1997@cluster0.tutce.mongodb.net/somethingNew";


// const mongoDBStore=require("connect-mongodb-session")(session)

// const store=new mongoDBStore({
//     uri:uri,
//     collection: 'sessions'
// })


// app.use(session({secret: "my secret", resave: false, saveUninitialized: false,store: store}))

// app.get('/prod',(req,res,next)=>{
//     console.log("in prod")
//     console.log(req.session)
//     res.send("<h1>hello from prod</h1>")
// })

// app.get('/',(req,res,next)=>{
//     req.session.isLoggedIn="True"
//     console.log("in another")
//     res.send("<h1>hello</h1>")
// })

// app.listen(3010)
