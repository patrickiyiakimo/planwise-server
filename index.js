require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");

// app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({extended: true}))

app.get("/", (req, res) => {
  res.send("Planwise backend is running");
});

app.use(
   cors({
     origin: "http://localhost:3000", // frontend URL
     credentials: true, // allow cookies/headers if needed
   })
 );

//  app.use(
//    cors({
//      origin: "https://planwise-mu.vercel.app/", // frontend URL
//      credentials: true, // allow cookies/headers if needed
//    })
//  );


const authRoutes = require('./src/routes/auth');
const taskRoutes = require('./src/routes/task');
const courseRoutes = require('./src/routes/course')

app.use('/api/auth', authRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/courses', courseRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
