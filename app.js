
const express=require("express")
const app=express();

const session=require("express-session")
// const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://Abhishek:Baba@1997@cluster0.tutce.mongodb.net/somethingNew";
const homeRoutes=require("./routes/home")
const prodRoutes=require("./routes/login")

const mongoDBStore=require("connect-mongodb-session")(session)

const store=new mongoDBStore({
    uri:uri,
    collection: 'sessions'
})


app.use(session({secret: "my secret", resave: false, saveUninitialized: false,store: store}))

app.use(prodRoutes)

app.use(homeRoutes)

app.listen(3010)
