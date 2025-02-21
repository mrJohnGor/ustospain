const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize app
const app = express(); // Ensure 'app' is declared here

// Middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Import routes
const propertyRoutes = require('./routes/properties'); // Ensure this line is after 'app' is defined

// Use property routes
app.use('/api/properties', propertyRoutes);

// Define a simple route
app.get('/', (req, res) => {
  res.send('Welcome to the Real Estate Platform!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});