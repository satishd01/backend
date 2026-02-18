const ProductSubcategory = require('../models/ProductSubcategory');
const ServiceSubcategory = require('../models/ServiceSubcategory');
const FoodSubcategory = require('../models/FoodSubcategory');
const ProductCategory = require('../models/ProductCategory');
const ServiceCategory = require('../models/ServiceCategory');
const FoodCategory = require('../models/FoodCategory');
const mongoose = require('mongoose');

// Get Product Subcategories by Category ID or Slug
exports.getProductSubcategories = async (req, res) => {
  try {
    const { categoryIdOrSlug } = req.params;
    let categoryId = categoryIdOrSlug;

    // Check if it's a slug (not a valid ObjectId)
    if (!mongoose.Types.ObjectId.isValid(categoryIdOrSlug)) {
      const category = await ProductCategory.findOne({ slug: categoryIdOrSlug });
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      categoryId = category._id;
    }

    const subcategories = await ProductSubcategory.find({ category: categoryId })
      .select('_id name slug')
      .sort({ name: 1 });

    res.json({ success: true, data: subcategories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get Service Subcategories by Category ID or Slug
exports.getServiceSubcategories = async (req, res) => {
  try {
    const { categoryIdOrSlug } = req.params;
    let categoryId = categoryIdOrSlug;

    // Check if it's a slug (not a valid ObjectId)
    if (!mongoose.Types.ObjectId.isValid(categoryIdOrSlug)) {
      const category = await ServiceCategory.findOne({ slug: categoryIdOrSlug });
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      categoryId = category._id;
    }

    const subcategories = await ServiceSubcategory.find({ category: categoryId })
      .select('_id name slug')
      .sort({ name: 1 });

    res.json({ success: true, data: subcategories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get Food Subcategories by Category ID or Slug
exports.getFoodSubcategories = async (req, res) => {
  try {
    const { categoryIdOrSlug } = req.params;
    let categoryId = categoryIdOrSlug;

    // Check if it's a slug (not a valid ObjectId)
    if (!mongoose.Types.ObjectId.isValid(categoryIdOrSlug)) {
      const category = await FoodCategory.findOne({ slug: categoryIdOrSlug });
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      categoryId = category._id;
    }

    const subcategories = await FoodSubcategory.find({ category: categoryId })
      .select('_id name slug')
      .sort({ name: 1 });

    res.json({ success: true, data: subcategories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};