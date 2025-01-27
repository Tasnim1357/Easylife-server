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
    // await client.connect();

  const usersCollection= client.db('assetManagement').collection('users')
  const employeeCollection= client.db('assetManagement').collection('employees')
  const hrCollection= client.db('assetManagement').collection('hr')
  const paymentCollection = client.db("assetManagement").collection("payments");
  const assetCollection = client.db("assetManagement").collection("assets");
  const requestCollection = client.db("assetManagement").collection("requested");
  const teamCollection = client.db("assetManagement").collection("team");




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

  app.get('/employee/:email',async(req,res)=>{
    const email=req.params.email
    const result = await employeeCollection.findOne({email})
   
    res.send(result)
  })





  
  app.get('/myteam/:email',async(req,res)=>{
    const email=req.params.email
    const result = await teamCollection.findOne({email})
    
    res.send(result)
  })
  
  app.get('/myteam2/:email',async(req,res)=>{
    const email = req.params.email;
    const { page, size } = req.query;
    
    // Parse page and size to integers
    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(size, 10);
  
    // Build the query object
    let query = { adminEmail: email };
  
    
    try {
      const skip = pageNum * pageSize; // Calculate the number of documents to skip
      const result = await teamCollection.find(query).skip(skip).limit(pageSize).toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: 'Internal Server Error', error });
    }
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

  app.get('/employees',verifyToken,verifyAdmin, async(req, res) => {
    console.log(req.headers)
    const page=parseInt(req.query.page)
    const size=parseInt(req.query.size)
   const result = await employeeCollection.find()
   .skip(page*size)
   .limit(size)
   .toArray();
     res.send(result);
 })


 app.get('/employees1',async(req,res)=>{
  const result=await employeeCollection.find().toArray()
  res.send(result)
})


app.get('/requests', verifyToken, verifyAdmin, async (req, res) => {
  const { name, email } = req.query;

  // Build the query object
  let query = {};

  if (name) {
    query.userName = { $regex: name, $options: 'i' }; // Case-insensitive regex search
  }

  if (email) {
    query.userEmail = { $regex: email, $options: 'i' }; // Case-insensitive regex search
  }

  try {
    const result = await requestCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error', error });
  }
});

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


app.get('/topmost-requests', async (req, res) => {
  try {
    // Aggregate to count the number of requests for each assetId
    const aggregationPipeline = [
      { $group: { _id: "$assetId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 4 } 
    ];

    const topmostRequests = await requestCollection.aggregate(aggregationPipeline).toArray();

    // Extract the assetIds of the topmost requested items
    const topmostAssetIds = topmostRequests.map(request => request._id);

    // Retrieve the details of the topmost requested items based on their assetId
    const topmostRequestDetails = await requestCollection.find({ assetId: { $in: topmostAssetIds } }).toArray();

    // Filter out any additional items that may have the same assetId but were not part of the top 4
    const filteredTopmostRequestDetails = topmostRequestDetails.filter((request, index) => index < 4);

    res.json(filteredTopmostRequestDetails);
  } catch (error) {
    console.error("Error retrieving topmost request details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get('/api/requests/pending', async (req, res) => {
  try {
    const pendingRequests = await requestCollection.find({ status1: 'pending' }).limit(5).toArray();
    res.json(pendingRequests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests/limited-stock', async (req, res) => {
  try {
    const limitedStockItems = await requestCollection.find({ 'quantity': { $lt: 10 } }).toArray();
    res.json(limitedStockItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/requests/pie-chart', async (req, res) => {
  try {
    const totalRequests = await requestCollection.countDocuments();
    const returnableRequests = await requestCollection.countDocuments({ type: 'returnable' });
    const nonReturnableRequests = totalRequests - returnableRequests;

    // const pieChartData = {
    //   returnable: (returnableRequests / totalRequests),
    //   nonReturnable: (nonReturnableRequests / totalRequests),
    // };

    const pieChartData=[
      {
        name: 'Returnable',
        value:  (returnableRequests / totalRequests),
      },
      {
        name: 'Non-returnable',
        value: (nonReturnableRequests / totalRequests)
      }

    ]

    res.json(pieChartData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.get('/pending-requests/:userEmail', async (req, res) => {
  const userEmail = req.params.userEmail;

  try {
    // Query to find pending requests for the given userEmail
    const pendingRequests = await requestCollection.find({
      userEmail: userEmail,
      status1: 'pending'
    }).toArray();

    res.json(pendingRequests);
  } catch (error) {
    console.error('Error retrieving pending requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





app.get('/pending-requests/:userEmail', async (req, res) => {
  const userEmail = req.params.userEmail;

  try {

    const pendingRequests = await requestCollection.find({
      userEmail: userEmail,
      status1: 'pending'
    }).toArray();

    res.json(pendingRequests);
  } catch (error) {
    console.error('Error retrieving pending requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/monthly-requests/:userEmail', async (req, res) => {
  const userEmail = req.params.userEmail;
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);


  try {

    const monthlyRequests = await requestCollection.find({
      userEmail: userEmail,
      requestDate: {
        $gte: startOfMonth.toISOString(),
        $lte: endOfMonth.toISOString()
      }
    }).sort({ requestDate: -1 }).toArray();


    res.json(monthlyRequests);
  } catch (error) {
    console.error('Error retrieving monthly requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




app.get('/team/:email', async (req, res) => {
  const email = req.params.email;
  const { page, size } = req.query;
  
  // Parse page and size to integers
  const pageNum = parseInt(page, 10);
  const pageSize = parseInt(size, 10);


  let query = { adminEmail: email };

  
  try {
    const skip = pageNum * pageSize; 
    const result = await teamCollection.find(query).skip(skip).limit(pageSize).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error', error });
  }
});


app.get('/requestCount', async(req, res) => {
  const { search, type, status } = req.query;
  let query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  if (type) {
    query.type = type;
  }
  const count = await requestCollection.estimatedDocumentCount(query);
  res.send({count});
})
app.get('/requestsCount', async(req, res) => {
  const { search, email, status } = req.query;
  let query = {};

  if (search) {
    query.userName = { $regex: search, $options: 'i' }; // Case-insensitive regex search
  }
  if (email) {
    query.userEmail = { $regex: email, $options: 'i' }; // Case-insensitive regex search
  }
  const count = await requestCollection.estimatedDocumentCount(query);
  res.send({count});
})







app.get('/assets/emp',async (req, res) => {
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
 app.get('/teamCount', async(req, res) => {
  const count = await teamCollection.estimatedDocumentCount();
  res.send({count});
})
 app.get('/employeeCount', async(req, res) => {
  const count = await employeeCollection.estimatedDocumentCount();
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
  app.post('/team', async(req, res) => {
    const newTeam=req.body
    const result=await teamCollection.insertOne(newTeam)
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


  app.patch('/request/:id', async(req,res)=>{
    const id=req.params.id;
    const filter={_id: new ObjectId(id)}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
              status1:updatedRequest.status1,
             
            },
    }
    const result=await requestCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  
  app.patch('/hr/:email', async (req, res) => {
    const email = req.params.email;
    const { memberCount3 } = req.body; // Expecting an increment value in the request body
   
  
    try {
      const result = await hrCollection.updateOne(
        { email:email },
        { $inc: { memberCount: memberCount3 } }
      );
   
      if (result.modifiedCount > 0) {
        res.status(200).send({ message: 'membercount updated successfully' });
      } else {
        res.status(404).send({ message: 'member count not found' });
      }
    } catch (error) {
      res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
  });
  app.patch('/hr/:email', async (req, res) => {
    const email = req.params.email;
    const { memberCount3 } = req.body; // Expecting an increment value in the request body
   
  
    try {
      const result = await hrCollection.updateOne(
        { email:email },
        { $inc: { memberCount: memberCount3 } }
      );
   
      if (result.modifiedCount > 0) {
        res.status(200).send({ message: 'membercount updated successfully' });
      } else {
        res.status(404).send({ message: 'member count not found' });
      }
    } catch (error) {
      res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
  });
  app.patch('/employee/:id', async(req,res)=>{
    const id=req.params.id;
    const filter={_id: new ObjectId(id)}
    const updatedEmployee = req.body;
  
    const updateDoc={
            $set:{
             company: updatedEmployee.company,
             logo: updatedEmployee.logo
             
            },
    }
    const result=await employeeCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/requesthr/:id',verifyToken,verifyAdmin, async(req,res)=>{
    const id=req.params.id;
    const filter={_id: new ObjectId(id)}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
              status1:updatedRequest.status1,
              approvalDate: updatedRequest.approvalDate
             
            },
    }
    const result=await requestCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/hrpack/:email', async(req,res)=>{
    const email=req.params.email;
    const filter={email: email}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
            package1: updatedRequest.plan
             
            },
    }
    const result=await hrCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/employeename/:email', async(req,res)=>{
    const email=req.params.email;
    const filter={email: email}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
            name: updatedRequest.name
             
            },
    }
    const result=await employeeCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/teamname/:email', async(req,res)=>{
    const email=req.params.email;
    const filter={email: email}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
            name: updatedRequest.name
             
            },
    }
    const result=await teamCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/reqname/:email', verifyToken, async(req,res)=>{
    const email=req.params.email;
    const filter={userEmail: email}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
            userName: updatedRequest.name
             
            },
    }
    const result=await requestCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/hrname/:email', async(req,res)=>{
    const email=req.params.email;
    const filter={email: email}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
            name: updatedRequest.name
             
            },
    }
    const result=await hrCollection.updateOne(filter,updateDoc)
    res.send(result)
  })
  app.patch('/teamhrname/:email', async(req,res)=>{
    const email=req.params.email;
    const filter={adminEmail: email}
    const updatedRequest = req.body;
  
    const updateDoc={
            $set:{
            admin: updatedRequest.name
             
            },
    }
    const result=await teamCollection.updateOne(filter,updateDoc)
    res.send(result)
  })




  app.patch('/assetlist/:assetId',verifyToken, async (req, res) => {
    const assetId = req.params.assetId;
    const { incrementBy } = req.body; // Expecting an increment value in the request body
   
    if (!ObjectId.isValid(assetId)) {
      return res.status(400).send({ message: 'Invalid asset ID' });
    }
  
    try {
      const result = await assetCollection.updateOne(
        { _id: new ObjectId(assetId) },
        { $inc: { quantity: incrementBy } }
      );
   
      if (result.modifiedCount > 0) {
        res.status(200).send({ message: 'Asset quantity updated successfully' });
      } else {
        res.status(404).send({ message: 'Asset not found' });
      }
    } catch (error) {
      res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
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
  app.delete('/team/:id',async(req,res)=>{
    const id=  req.params.id;
    const query={_id:new ObjectId(id)}
    const result=await teamCollection.deleteOne(query);
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

 
    res.send(paymentResult)
  })









    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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