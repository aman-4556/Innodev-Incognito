const bodyParser = require("body-parser");
var express= require("express");
var bcrypt=require('bcrypt');
const session=require('express-session');
var formidable=require("formidable");
var fs=require("fs");

var app = express();
app.use("/static", express.static(__dirname+"/static"));
app.use("/uploads", express.static(__dirname+"/uploads"));
app.set("view engine","ejs");

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(session({
    key:"user_id",
    secret:'User secret Object Id',
    saveUninitialized:true,
    resave:true
}));

//a function to return user's document

var mongodb=require("mongodb");
var MongoClient=mongodb.MongoClient;
var ObjectId=mongodb.ObjectId;

MongoClient.connect("mongodb://localhost:27017/",{useNewUrlParser:true},
        function(error,client){
            var database=client.db("innodev");
            console.log("Db connected");

            function getUser(id,callBack) {
                database.collection("users").findOne({
                    "_id":ObjectId(id)
                },function (error,user) {
                callBack(user);        
                });
            }
            
            app.get('/',(req,res)=>{
               
                database.collection("items").find({}).sort({
                    "createdAt":-1
                }).toArray(function(error,items){
                    res.render("index",{
                        "isLogin":req.session.user_id? true :false,
                        "videos":items
                    });
                });  
            });
            

            app.get('/login',(req,res)=>{
                res.render("login",{
                    error:"",
                    message:""
                });
            });

            app.post("/login",function (req,res) {
                database.collection("users").findOne({
                    "email":req.body.email
                },function(error,user){
                    if (user==null) {
                        //not exists
                        // res.send("email doesn't exists"); 
                        alert("email doesn't exists");   
                    }else{
                        //exists
                        bcrypt.compare(req.body.pass,user.password,function (error,isVerify) {
                            if(isVerify){
                                //saving user id in session 
                                req.session.user_id=user._id;
                                res.redirect("/");
                            }else{
                                res.send("<h2>wrong password</h2>");
                                // alert("Wrong Password");
                            }
                        });
                    }
                });
            });

            
            app.get('/signup',(req,res)=>{
                res.render("signup");
            });

            app.post("/signup",function(req,res){
                database.collection("users").findOne({
                    "email":req.body.email
                },function(error,user){
                    if (user==null) {
                        //not exists
                        
                        //convert pass into hash
                        bcrypt.hash(req.body.password,10,function(error,hash) {
                            database.collection("users").insertOne({
                                "name":req.body.name,
                                "email":req.body.email,
                                "password":hash,
                                "image":"",                         
                                "notifications":[]
                            },function (error,data) {
                                res.redirect("/login");
                            })                           
                        })
                    }else{
                        //exists
                        //res.send("email already exists");
                        alert("Email already exists");
                    }
                });
            });

            app.get("/logout",(req,res)=>{
                req.session.destroy();
                res.redirect("/");
            });
            app.get("/add-item",(req,res)=>{
                if(req.session.user_id){
                    //page for upload
                    res.render("add-item",{
                        isLogin:true
                    });
                }else{
                    res.redirect("/login");
                }
            });

            app.post("/add-item",(req,res)=>{
                //check user is logged in
                if (req.session.user_id) {
                    var form=new formidable.IncomingForm();
                    form.parse(req,(error,fields,files)=>{
                        var title=fields.title;
                        var description=fields.description;
                        var price=fields.price;
                        var category=fields.category;

                        var oldPaththumbnail=files.thumbnail.filepath;
                        var newPaththumbnail= "uploads/thumbnails/"+ new Date().getTime()+"-"+files.thumbnail.originalFilename;
                        fs.rename(oldPaththumbnail,newPaththumbnail,(error)=>{
                            //
                            getUser(req.session.user_id,(user)=>{
                                var currentTime=new Date().getTime();
                            database.collection("items").insertOne({
                                "user":{
                                    "_id":user._id,
                                    "name":user.name,
                                    "image":user.image,
                                     
                                },
                                
                                "thumbnail":newPaththumbnail,
                                "title":title,
                                "descriptions":description,
                                "category":category,
                                "createdAt":currentTime,
                                "price":price
                            },function (error,data) {
                                //insertin in users collection too
                                 database.collection("users").updateOne({
                                    "_id":ObjectId(req.session.user_id)
                                 },{
                                    $push:{
                                        "items":{
                                            "_id":data.insertedId,
                                            "title":title,
                                            "views":0,
                                            
                                        }
                                    }
                                 });
                                 res.redirect("/");                                      
                            });
                        });
                        });

                      });
                } else {
                    res.redirect("/login");
                }
            });

            app.get("/watch/:watch",function (req,res) {
                database.collection("items").findOne({
                    "createdAt":parseInt(req.params.watch)
                },function (error,video) {
                    if (video==null) {
                        res.send("Product does not exist");
                    } else {                         
                            res.render("product",{
                                "isLogin":req.session.user_id? true:false,
                                "video":video, 
                                  
                            }); 
                                                     
                    }
                });
            });

            app.get("/dashboard",(req,res)=>{
               
                database.collection("items").find({
                 "user._id":ObjectId(req.session.user_id)
                }).sort({
                 "createdAt":-1
                 }).toArray(function(error,videos){
                      getUser(req.session.user_id,(user)=>{
                         database.collection("photos").findOne({
                             "user._id":ObjectId(req.session.user_id)
                         },function (error,photo) {
                             res.render("dashboard",{
                                 "isLogin":req.session.user_id? true :false,
                                 "user":user,
                                 "videos":videos,
                                 "photo":photo
                             }) 
                         })
                         
                     })
                 
              });
         });

         app.post("/delete",(req,res)=>{
             database.collection("items").deleteOne({"_id":ObjectId(req.body.deleteId)});
             res.redirect("/dashboard");
         });


         app.get("/editProfile",(req,res)=>{
                
            res.render("editProfile",{
                "isLogin":true,

            }); 
        
    })

    app.post("/editProfile",(req,res)=>{
        if (req.session.user_id) {
            var formData=new formidable.IncomingForm();
            formData.maxFileSize =1000*1024*1024;
            formData.parse(req,(error,fields,files)=>{
               
                //var thumbnail=fields.thumbnail;
                var oldPathcoverPhoto=files.coverPhoto.filepath;
                var newPathcoverPhoto= "uploads/coverPhoto/"+ new Date().getTime()+"-"+files.coverPhoto.originalFilename;
                fs.rename(oldPathcoverPhoto,newPathcoverPhoto,(error)=>{
                    //
                });
                var oldPathimage=files.image.filepath;
                var newPathimage= "uploads/image/"+ new Date().getTime()+"-"+files.image.originalFilename;
                fs.rename(oldPathimage,newPathimage,(error)=>{
                    getUser(req.session.user_id,(user)=>{
                        var currentTime=new Date().getTime();
                        database.collection("photos").insertOne({
                            "user":{
                                "_id":user._id,
                                "name":user.name,
                                "subscribers":user.subscribers
                            },
                            "coverPhoto":newPathcoverPhoto,
                            "image":newPathimage
                         });
                         res.redirect("/");
                    });    
                });
            })
        }else{
            res.redirect("/login");
        }
    })

            app.listen(8080,()=>{
                console.log('listening at http://localhost:8080');
            });
            
        });