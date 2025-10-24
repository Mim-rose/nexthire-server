const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// 🔒 Middleware

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "https://next-hire-nine.vercel.app", // your Vercel frontend
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));




app.use(express.json());

// 🗂️ File upload middleware
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }
});

// 🔗 MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.skka1tn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// 🔌 MongoDB client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

// 💾 Declare global collections
let jobsCollection;
let jobApplicationCollection;

// 🌐 Root Route (this can stay outside)
app.get('/', (req, res) => {
  res.send('🚀 Welcome to the NextHire API');
});

// 🚀 Connect and define ALL routes inside
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB");

    jobsCollection = client.db('NextHire').collection('Jobs');
    jobApplicationCollection = client.db('NextHire').collection('job_applications');

    // ✅ NOW define all routes that need database access

    // 🚋 Categories
    app.get('/api/categories', async (req, res) => {
      try {
        if (!jobsCollection) {
          console.error("🚨 jobsCollection is undefined");
          return res.status(500).json({ message: "jobsCollection not available" });
        }

        console.log("🔍 Attempting to fetch distinct categories…");
        const categories = await jobsCollection.distinct('category');
        console.log("✅ categories response:", categories);

        if (!Array.isArray(categories)) {
          console.error("🚨 categories is not an array");
          return res.status(500).json({ message: "Invalid categories format" });
        }

        res.send(categories);
      } catch (err) {
        console.error("❌ Failed to fetch categories:", err);
        res.status(500).json({ message: 'Could not fetch categories' });
      }
    });

    // 🚋 Companies
    app.get("/api/companies", async (req, res) => {
      try {
        const jobs = await jobsCollection.find({ status: "active" }).toArray();

        const companyMap = new Map();

        jobs.forEach((job) => {
          const name = job.company;
          const logo = job.company_logo;
          const location = job.location;

          if (!name || !logo) return;

          if (!companyMap.has(name)) {
            companyMap.set(name, {
              name,
              logo,
              location,
              jobCount: 1,
              rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
              reviews: Math.floor(Math.random() * 200) + 20,
            });
          } else {
            const existing = companyMap.get(name);
            existing.jobCount += 1;
          }
        });

        const companies = Array.from(companyMap.values());
        res.json(companies);
      } catch (error) {
        console.error("Error fetching companies:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // All companies
    app.get("/api/companies/all", async (req, res) => {
      try {
        const jobs = await jobsCollection.find({ status: "active" }).toArray();

        const companyMap = new Map();

        jobs.forEach((job) => {
          const name = job.company;
          const logo = job.company_logo;
          const location = job.location;

          if (!name || !logo) return;

          if (!companyMap.has(name)) {
            companyMap.set(name, {
              name,
              logo,
              location,
              jobCount: 1,
              rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
              reviews: Math.floor(Math.random() * 200) + 20,
            });
          } else {
            const existing = companyMap.get(name);
            existing.jobCount += 1;
          }
        });

        const allCompanies = Array.from(companyMap.values());
        res.json(allCompanies);
      } catch (err) {
        console.error("❌ Failed to fetch all companies:", err);
        res.status(500).json({ error: "Failed to fetch companies" });
      }
    });

    // Company jobs
    app.get("/api/companies/:companyName", async (req, res) => {
      try {
        const companyName = req.params.companyName;

        const jobs = await jobsCollection.find({
  company: { $regex: `^${companyName}$`, $options: 'i' },
  status: "active"
}).toArray();


        if (jobs.length === 0) {
          return res.status(404).json({ error: "No jobs found for this company" });
        }

        res.json({ jobs });
      } catch (err) {
        console.error("❌ Error fetching jobs for company:", err);
        res.status(500).json({ error: "Failed to fetch jobs for company" });
      }
    });

    // JWT
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      })
        .json({ success: true, token: token });
    });

    // Search
    app.get("/api/search", async (req, res) => {
      const query = req.query.q;
      if (!query) return res.status(400).json({ error: "Missing search query" });

      const regex = new RegExp(query, "i");

      try {
        const jobs = await jobsCollection.find({
          $or: [
            { title: regex },
            { company: regex },
            { category: regex },
            { location: regex },
            { description: regex }
          ]
        }).toArray();

        res.json(jobs);
      } catch (err) {
        console.error("❌ Search error:", err);
        res.status(500).json({ error: "Search failed" });
      }
    });

    // Locations
    app.get('/api/locations', async (req, res) => {
      try {
        if (!jobsCollection) return res.status(500).json({ message: "jobsCollection not ready" });
        const locations = await jobsCollection.distinct('location');
        res.json(locations);
      } catch (err) {
        console.error("Error fetching locations:", err);
        res.status(500).json({ message: "Could not fetch locations" });
      }
    });

    // Subscribe
    app.post("/api/subscribe", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      await subscriptionsCollection.insertOne({ email, subscribedAt: new Date() });
      res.json({ message: "Subscribed successfully" });
    });

    // Check auth
    app.get('/check-auth', (req, res) => {
      console.log('Cookies:', req.cookies);
      res.json({ authenticated: !!req.cookies.token });
    });

    // Featured jobs
    app.get('/jobs/featured', async (req, res) => {
      try {
        const jobs = await jobsCollection.find()
          .sort({ isFeatured: -1, createdAt: -1 })
          .limit(15)
          .toArray();
        res.send(jobs);
      } catch (err) {
        res.status(500).json({ message: "Could not fetch jobs" });
      }
    });

    // All jobs
    app.get('/jobs/all', async (req, res) => {
      try {
        const { page = 1, limit = 20 } = req.query;
        const jobs = await jobsCollection.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();
        res.send(jobs);
      } catch (err) {
        res.status(500).json({ message: "Could not fetch jobs" });
      }
    });

    // Single job
    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // Post job
    app.post('/jobs', async (req, res) => {
      const newjob = req.body;
      newjob.createdAt = new Date();
      const result = await jobsCollection.insertOne(newjob);
      res.send(result);
    });

    // User's posted jobs
    app.get('/jobs', async (req, res) => {
      const email = req.query.email;
      try {
        const jobs = await jobsCollection.find({ postedBy: email }).toArray();
        res.json(jobs);
      } catch (err) {
        console.error("Error fetching user's posted jobs:", err);
        res.status(500).json({ message: "Failed to fetch jobs" });
      }
    });

    // Job applications
    app.get('/job-applications', async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };
      console.log('Cuk cuk tokoto', req.cookies);

      try {
        const result = await jobApplicationCollection.find(query).toArray();

        const enrichedApplications = await Promise.all(result.map(async (app) => {
          const job = await jobsCollection.findOne({ _id: new ObjectId(app.job_id) });

          if (job) {
            app.job = job;
            app.title = job.title;
            app.location = job.location;
            app.company = job.company;
            app.company_logo = job.company_logo;
            app.jobType = job.jobType;
            app.category = job.category;
            app.salaryRange = job.salaryRange;
          }

          return app;
        }));

        res.send(enrichedApplications);
      } catch (err) {
        console.error('Error fetching applications:', err);
        res.status(500).send({ message: 'Failed to load applications' });
      }
    });

    // Submit application
    app.post(
      '/job-applications',
      upload.fields([
        { name: 'resume', maxCount: 1 },
        { name: 'coverLetter', maxCount: 1 }
      ]),
      async (req, res) => {
        try {
          const application = {
            job_id: req.body.job_id,
            applicant_email: req.body.applicant_email,
            applicant_name: req.body.applicant_name,
            applicant_phone: req.body.applicant_phone,
            applicant_linkedin: req.body.applicant_linkedin,
            applicant_notes: req.body.applicant_notes,
            resume: req.files?.resume?.[0]?.originalname || null,
            coverLetter: req.files?.coverLetter?.[0]?.originalname || null
          };

          const result = await jobApplicationCollection.insertOne(application);

          const id = application.job_id;
          const query = { _id: new ObjectId(id) };
          const job = await jobsCollection.findOne(query);
          console.log("Job details for application:", job);
          let newCount;

          if (job.applicationCount) {
            newCount = job.applicationCount + 1;
          } else {
            newCount = 1;
          }

          const filter = { _id: new ObjectId(id) };
          const updatedDoc = {
            $set: {
              applicationCount: newCount
            }
          }

          const updateResult = await jobsCollection.updateOne(filter, updatedDoc);

          res.status(200).json({
            insertedId: result.insertedId,
            jobDetails: job
          });

        } catch (err) {
          console.error('❌ Submission error:', err);
          res.status(500).json({ message: 'Failed to process application' });
        }
      }
    );

    // Delete application
    app.delete('/job-applications/:id', async (req, res) => {
      try {
        const result = await jobApplicationCollection.deleteOne({
          _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Application not found' });
        }

        res.json({
          success: true,
          deletedCount: result.deletedCount
        });
      } catch (err) {
        console.error('❌ Deletion error:', err);
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Category jobs
    app.get('/jobs/category/:category', async (req, res) => {
      try {
        const category = req.params.category;
        const query = { category };
        const jobs = await jobsCollection.find(query).toArray();
        res.send(jobs);
      } catch (err) {
        console.error('❌ Failed to fetch category jobs:', err);
        res.status(500).json({ message: 'Could not fetch category jobs' });
      }
    });

    // 🚦 Start Server ONLY AFTER all routes are defined
    app.listen(port, () => {
      console.log(`🟢 Server running on port ${port}`);
      console.log(`📊 Database: Connected`);
      console.log(`✅ All routes registered`);
    });

  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
}

run();