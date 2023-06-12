const express = require("express");
const app = express();
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;


// middleware
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan("dev"))



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ys20m5d.mongodb.net/?retryWrites=true&w=majority`;


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
        client.connect();

        // database collections
        const addClassCollection = client.db("harmoniaAcademyDb").collection("addClass");
        const usersCollection = client.db("harmoniaAcademyDb").collection("users");
        const selectCollection = client.db("harmoniaAcademyDb").collection("select");
        const paymentCollection = client.db("harmoniaAcademyDb").collection("payment");
        const enrolledCollection = client.db("harmoniaAcademyDb").collection("enrolled");


        app.post("/addClass", async (req, res) => {
            const cls = req.body;
            console.log(cls)
            const result = await addClassCollection.insertOne(cls);
            res.send(result);
        })


        app.get("/classes", async (req, res) => {
            const result = await addClassCollection.find().toArray();
            res.send(result);
        })

        // get by id
        app.get("/class/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addClassCollection.find(query).toArray();
            res.send(result);
        })

        app.patch("/class/status/:id", async (req, res) => {
            const id = req.params.id;
            const status = req.body.status
            console.log(status)
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: status,
                },
            }

            const update = await addClassCollection.updateOne(query, updateDoc);
            res.send(update)
        })

        // feedback add
        app.put("/class/feedback/:id", async (req, res) => {
            const id = req.params.id;
            const feedback = req.body.feedback
            console.log(feedback)
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: feedback,
                },
            }
            const update = await addClassCollection.updateOne(query, updateDoc);
            res.send(update)
        })


        // update my classes
        app.put("/update/:id", async (req, res) => {
            const id = req.params.id;
            console.log("update id", id)
            const updateClass = req.body;
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: updateClass,
            }

            const result = await addClassCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })



        // Save user email and role in DB
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const query = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        // Get a user
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            res.send(result)
        })

        // get all users
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })


        // add a user
        app.post('/user', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            console.log(existingUser)

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });


        // Instructors
        app.get("/instructors", async (req, res) => {
            const instructorRole = await usersCollection.find({ role: 'instructor' }).toArray();
            res.send(instructorRole)
        })


        // get select class
        app.get("/selected", async (req, res) => {
            const result = await selectCollection.find().toArray()
            res.send(result)
        })


        //get select class by id
        app.post('/select', async (req, res) => {
            const { _id } = req.body;
            const existingUser = await selectCollection.findOne({_id});

            if (existingUser) {
                return res.send({ message: 'Class already exists' })
            } else {

                const result = await selectCollection.insertOne(req.body);
                res.send(result);
            }
        });


        // select class delete
        app.delete("/selectClass/:id", async(req, res) => {
            const id = req.params.id;
            const result = await selectCollection.deleteOne({_id: id})
            res.send(result)
        })

        // get select class by id
        app.get("/selectClass/:id", async(req, res) => {
            const id = req.params.id;
            const result = await selectCollection.findOne({_id: id})
            res.send(result)
        })


        // create payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const {classPrice} = req.body;
            console.log(classPrice)

            const amount = parseInt(classPrice * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        }) 
 

        // payment related api
        app.post('/payment', async (req, res) => {
            const payment = req.body;
            const {id} = req.body;

            const insertResult = await paymentCollection.insertOne(payment);

            const deleteResult = await selectCollection.deleteOne({_id: id})

            res.send({ insertResult, deleteResult });  
        })


        // get enrolled Data
        app.get("/enrolled/:email", async(req, res) => {
            const email = req.params.email;
            const query = {email: email}
            console.log(query)
            const result = await paymentCollection.find(query).toArray();
            res.send(result)
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


app.get("/", (req, res) => {
    res.send("Harmonia Academy Server is running...")
})

app.listen(port, () => {
    console.log(`Harmonia Academy is running on port: ${port}`)
})