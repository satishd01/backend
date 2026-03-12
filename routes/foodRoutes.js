const express = require('express');
const router = express.Router();

const {
  createFood,
  getMyFoods,
  getBusinessFoodById,
  getFoodById,
  updateFood,
  deleteFood,
  getFoodUploadUrl,
} = require('../controllers/foodController');

const authenticate = require('../middlewares/authenticate');
const isBusinessOwner = require('../middlewares/isBusinessOwner');

router.get('/upload-url', authenticate, getFoodUploadUrl);

router.post('/add-food', authenticate, isBusinessOwner, createFood);

router.get('/my-foods', authenticate, isBusinessOwner, getMyFoods);

router.get('/business-food/:id', getBusinessFoodById);

router.get('/food-by-id/:id', authenticate, isBusinessOwner, getFoodById);

router.put('/update-food/:id', authenticate, isBusinessOwner, updateFood);

router.delete('/delete-food/:id', authenticate, isBusinessOwner, deleteFood);

router.get('/', (req, res) => {
  res.json({ message: 'Food API is working' });
});

module.exports = router;
