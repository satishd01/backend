const mongoose = require('mongoose');
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mbh");
    console.log('MongoDB connected');
  } catch (err) {
    console.error('DB connection error:', err.message);
    process.exit(1);
  }
};
module.exports = connectDB;
