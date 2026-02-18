const Product = require('../../models/Product');

// Toggle product featured status
exports.toggleProductFeatured = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isFeatured } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: productId, isDeleted: false },
      { isFeatured: isFeatured },
      { new: true, runValidators: false }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({
      message: `Product ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      product: {
        _id: product._id,
        title: product.title,
        isFeatured: product.isFeatured
      }
    });
  } catch (error) {
    console.error('Error toggling product featured status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all products for admin management
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, featured } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (featured !== undefined) {
      filter.isFeatured = featured === 'true';
    }

    const products = await Product.find(filter)
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('businessId', 'businessName')
      .select('title coverImage isFeatured isPublished createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Server error' });
  }
};