require('dotenv').config()
const express = require('express');
const cors=require('cors');
const jwt= require('jsonwebtoken')
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app=express();
const port= process.env.PORT || 5000;



// middleware

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cxnpdhc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

  const usersCollection= client.db('assetManagement').collection('users')
  const employeeCollection= client.db('assetManagement').collection('employees')
  const hrCollection= client.db('assetManagement').collection('hr')
  const paymentCollection = client.db("assetManagement").collection("payments");
  const assetCollection = client.db("assetManagement").collection("assets");
  const requestCollection = client.db("assetManagement").collection("requested");




 // middlewares

 const verifyToken=(req, res,next)=>{
  console.log('inside verify token',req.headers);
  if(!req.headers.authorization){
    return res.status(401).send({message: 'forbidden access'})
  }
  const token= req.headers.authorization.split(' ')[1];
  
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
    if(err){
      return res.status(401).send({message: 'forbidden access'})

    }
    console.log('Decoded token:', decoded);

    req.decoded=decoded;
    console.log(req.decoded)
    next()
  })
  
}

 const verifyAdmin= async (req, res,next)=>{

  const email= req.decoded.email;
  const query= {email: email};
  const user = await usersCollection.findOne(query);
  const isAdmin= user?.role === 'HR';
  if(!isAdmin){
    return res.status(403).send({message: 'foebidden access'})
  }
  next()
 }







  // jwt related api

  app.post('/jwt',async(req,res)=>{
    
    const user= req.body;
    const token= jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn: '10h'});
    res.send({token})
  })


 


  app.get('/user/:email',async(req,res)=>{
    const email=req.params.email
    const result = await usersCollection.findOne({email})
    
    res.send(result)
  })
  app.get('/hr/:email',async(req,res)=>{
    const email=req.params.email
    const result = await hrCollection.findOne({email})
   
    res.send(result)
  })




  app.get('/assets',verifyToken,verifyAdmin, async(req, res) => {
    console.log(req.headers)
    const page=parseInt(req.query.page)
    const size=parseInt(req.query.size)
   const result = await assetCollection.find()
   .skip(page*size)
   .limit(size)
   .toArray();
     res.send(result);
 })


//  app.get('/assets/emp',async(req,res)=>{
//   const result=await assetCollection.find().toArray()
//   res.send(result)
// })

app.get('/request/:email', async (req, res) => {
  const email = req.params.email;
  const { search, type, status, page, size } = req.query;
  
  // Parse page and size to integers
  const pageNum = parseInt(page, 10);
  const pageSize = parseInt(size, 10);

  // Build the query object
  let query = { userEmail: email };

  if (search) {
    query.name = { $regex: search, $options: 'i' }; // Case-insensitive regex search
  }

  if (type) {
    query.type = type;
  }

  if (status) {
    query.status1 = status;
  }

  try {
    const skip = pageNum * pageSize; // Calculate the number of documents to skip
    const result = await requestCollection.find(query).skip(skip).limit(pageSize).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error', error });
  }
});


app.get('/requestCount', async(req, res) => {
  const { search, type, status } = req.query;
  let query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' }; // Case-insensitive regex search
  }
  if (type) {
    query.type = type;
  }
  const count = await requestCollection.estimatedDocumentCount(query);
  res.send({count});
})







app.get('/assets/emp', async (req, res) => {
  const { search, type, status } = req.query;
  const page = parseInt(req.query.page);
  const size = parseInt(req.query.size);
  
  // Build the query object
  let query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' }; // Case-insensitive regex search
  }
  
  if (type) {
    query.type = type;
  }
  
  if (status) {
    query.status = status;
  }

  try {
    const skip = page * size; // Calculate the number of documents to skip
    const result = await assetCollection.find(query).skip(skip)
      .limit(size)
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error', error });
  }
});



app.get('/assetsCount', async(req, res) => {
  const { search, type, status } = req.query;
  let query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' }; // Case-insensitive regex search
  }
  if (type) {
    query.type = type;
  }
  const count = await assetCollection.estimatedDocumentCount(query);
  res.send({count});
})



 app.get('/productsCount', async(req, res) => {
  const count = await assetCollection.estimatedDocumentCount();
  res.send({count});
})


  app.get('/assets/:id',async(req,res) => {
    const id = req.params.id;
    const query={_id: new ObjectId(id)}
    const result=await assetCollection.findOne(query);
 
    res.send(result);
})

// post an asset
  app.post('/asset', async(req, res) => {
    const newAssets=req.body
    console.log(newAssets)
    const result=await assetCollection.insertOne(newAssets)
    res.send(result)
  })
  app.post('/request', async(req, res) => {
    const newRequest=req.body
    console.log(newRequest)
    const result=await requestCollection.insertOne(newRequest)
    res.send(result)
  })

  app.patch('/assets/:id',verifyToken,verifyAdmin,async(req,res)=>{
    const asset=req.body;
    const id= req.params.id;
    const filter={_id:new ObjectId(id)
    }
    const updatedDoc={
      $set:{
        name: asset.name,
        type: asset.type,
        quantity: asset.quantity,
        date: asset.date,
        status: asset.status
      }
    }
    const result=await assetCollection.updateOne(filter,updatedDoc);
    res.send(result);
  });

  app.delete('/assets/:id',verifyToken,verifyAdmin,async(req,res)=>{
    const id=  req.params.id;
    const query={_id:new ObjectId(id)}
    const result=await assetCollection.deleteOne(query);
    res.send(result)

  })
  app.delete('/request/:id',async(req,res)=>{
    const id=  req.params.id;
    const query={_id:new ObjectId(id)}
    const result=await requestCollection.deleteOne(query);
    res.send(result)

  })
    
app.put('/user',async(req,res)=>{
    const user= req.body;
    // check
    const isExist=await usersCollection.findOne({email: user?.email})
    if (isExist) return res.send(isExist)
    const options={upsert: true}
    const query={email: user?.email}
    const updateDoc={
        $set: {
            ...user,
            timestamp: Date.now(),
        },
    }
    const result= await usersCollection.updateOne(query,updateDoc,options);
    res.send(result)
})

app.put('/employee',async(req,res)=>{
    const user= req.body;
    // check
    const isExist=await employeeCollection.findOne({email: user?.email})
    if (isExist) return res.send(isExist)
    const options={upsert: true}
    const query={email: user?.email}
    const updateDoc={
        $set: {
            ...user,
           
        },
    }
    const result= await employeeCollection.updateOne(query,updateDoc,options);
    res.send(result)
})
app.put('/hr',async(req,res)=>{
    const user= req.body;
    // check
    const isExist=await hrCollection.findOne({email: user?.email})
    if (isExist) return res.send(isExist)
    const options={upsert: true}
    const query={email: user?.email}
    const updateDoc={
        $set: {
            ...user,
           
        },
    }
    const result= await hrCollection.updateOne(query,updateDoc,options);
    res.send(result)
})


// Payment intent
app.post("/create-payment-intent", async (req, res) => {
  const { price } = req.body;
  const amount=parseInt(price*100);
  // console.log(amount,'amount inside the intent')

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types:['card']
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    // automatic_payment_methods: {
    //   enabled: true,
    // },
  });

  
res.send({
clientSecret: paymentIntent.client_secret
});
});


  //payment related  api
  app.get('/payments/:email',async(req,res)=>{
    const query={email: req.params.email}
    if(req.params.email !== req.decoded.email){
      return res.status(403).send({message:'forbidden access'})
    }
    const result=await paymentCollection.find().toArray()
    res.send(result)
})

  app.post('/payments',async(req,res)=>{
    const payment=req.body;
    const paymentResult= await paymentCollection.insertOne(payment);

    // carefully delete each item from the cart
    // console.log('payment info',payment);
  
    // const query= {_id:{
    //   $in: payment.cartIds.map(id=> new ObjectId(id))
    // }};
    // const deleteResult= await cartCollection.deleteMany(query)
    res.send(paymentResult)
  })









    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);











app.get('/',(req,res)=>{
    res.send('Assignment 12 server is running');
}) 

app.listen(port,()=>{
    console.log(`Assignment 12 server is running on port ${port}`)
})