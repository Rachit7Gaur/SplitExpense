
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const groupRoutes = require('./routes/groupRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentProfileRoutes = require('./routes/paymentProfileRoutes');

const {
  notFound,
  errorHandler
} = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json({ limit: '10kb' }));


const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  }
});

app.use('/api', apiLimiter);


app.get('/', (req, res) => {
  res.send('SplitExpense API is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/payment-profile', paymentProfileRoutes);

app.use(notFound);
app.use(errorHandler);


connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SplitExpense server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start SplitExpense:', error.message);
    process.exit(1);
  });
