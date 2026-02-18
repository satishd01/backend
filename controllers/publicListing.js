const Service = require('../models/Service');
const Review = require('../models/Review');
const ServiceCategory = require('../models/ServiceCategory');
const ServiceSubcategory = require('../models/ServiceSubcategory');

exports.getAllServices = async (req, res) => {
  try {
    const {
      search = '',
      city,
      state,
      country,
      minorityType,
      categorySlug,
      categoryId,
      subcategorySlug,
      subcategoryId,
      businessId,
      sort,
      openNow,
      onlineBooking,
      offers,
      page = 1,
      limit = 10,
      price,
      badge,
    } = req.query;

    const filters = { isPublished: true };

    // Search
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'services.name': { $regex: search, $options: 'i' } },
      ];
    }

    if (minorityType) filters.minorityType = minorityType;
    if (city) filters['contact.address'] = { $regex: city, $options: 'i' };

    if (businessId) filters.businessId = businessId;

    // Category filtering - accept both slug and ID
    if (categoryId) {
      filters.categoryId = categoryId;
    } else if (categorySlug) {
      const category = await ServiceCategory.findOne({ slug: categorySlug });
      if (category) {
        filters.categoryId = category._id;
      } else {
        return res.json({ success: true, total: 0, page: parseInt(page), totalPages: 0, data: [] });
      }
    }

    // Subcategory filtering - accept both slug and ID
    if (subcategoryId) {
      filters.subcategoryId = subcategoryId;
    } else if (subcategorySlug) {
      const subcategory = await ServiceSubcategory.findOne({ slug: subcategorySlug });
      if (subcategory) {
        filters.subcategoryId = subcategory._id;
      } else {
        return res.json({ success: true, total: 0, page: parseInt(page), totalPages: 0, data: [] });
      }
    }

    if (onlineBooking === 'true') filters.features = { $in: ['Online Booking'] };
    if (offers === 'true') filters.features = { $in: ['Offers Available'] };

    // Price filtering
    if (price) {
      const priceRange = price.split('-');
      if (priceRange.length === 2) {
        const minPrice = parseFloat(priceRange[0]);
        const maxPrice = parseFloat(priceRange[1]);
        filters.price = { $gte: minPrice, $lte: maxPrice };
      }
    }

    // Badge filtering
    if (badge) {
      const badges = Array.isArray(badge) ? badge : [badge];
      filters.badge = { $in: badges };
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { averageRating: -1 };
    if (sort === 'reviews') sortOption = { totalReviews: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const services = await Service.find(filters)
      .select('title services averageRating totalReviews slug description contact.address coverImage location price badge')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Service.countDocuments(filters);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: services,
    });
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// GET /api/public/services/:slug

exports.getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const service = await Service.findOne({ slug, isPublished: true })
      .populate('categories.categoryId', 'name')
      .populate('ownerId', 'businessName');

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // 👉 Fetch related reviews
    const reviews = await Review.find({
      listingId: service._id,
      listingType: 'service',
    })
      .populate('userId', 'name profileImage'); // Adjust fields as needed

    res.status(200).json({
      success: true,
      data: {
        service,
        reviews,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




// controllers/publicListing.js
const Food = require('../models/Food');
const FoodCategory = require('../models/FoodCategory');
const FoodSubcategory = require('../models/FoodSubcategory');

exports.getAllFood = async (req, res) => {
  try {
    const {
      search = '',
      city,
      state,
      country,
      minorityType,
      categorySlug,
      categoryId,
      subcategorySlug,
      subcategoryId,
      businessId,
      sort,
      offers,
      page = 1,
      limit = 10,
      outOfStock = false,
      price,
      badge,
    } = req.query;

    const filters = { isPublished: true };

    // Search filter
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by minorityType, city, state, and country
    if (minorityType) filters.minorityType = minorityType;
    if (city) filters['address.city'] = { $regex: city, $options: 'i' };
    if (state) filters['address.state'] = { $regex: state, $options: 'i' };
    if (country) filters['address.country'] = { $regex: country, $options: 'i' };

    // Filter by businessId
    if (businessId) filters.businessId = businessId;

    // Category filtering - accept both slug and ID
    if (categoryId) {
      filters.categoryId = categoryId;
    } else if (categorySlug) {
      const category = await FoodCategory.findOne({ slug: categorySlug });
      if (category) {
        filters.categoryId = category._id;
      } else {
        return res.json({ success: true, total: 0, page: parseInt(page), totalPages: 0, data: [] });
      }
    }

    // Subcategory filtering - accept both slug and ID
    if (subcategoryId) {
      filters.subcategoryId = subcategoryId;
    } else if (subcategorySlug) {
      const subcategory = await FoodSubcategory.findOne({ slug: subcategorySlug });
      if (subcategory) {
        filters.subcategoryId = subcategory._id;
      } else {
        return res.json({ success: true, total: 0, page: parseInt(page), totalPages: 0, data: [] });
      }
    }

    // Offers filter
    if (offers === 'true') filters.features = { $in: ['Offers Available'] };

    // Out of stock filter
    if (outOfStock === 'true') {
      filters.stockQuantity = { $lte: 0 };  // Assuming stockQuantity tracks available stock
    }

    // Price filtering
    if (price) {
      const priceRange = price.split('-');
      if (priceRange.length === 2) {
        const minPrice = parseFloat(priceRange[0]);
        const maxPrice = parseFloat(priceRange[1]);
        filters.price = { $gte: minPrice, $lte: maxPrice };
      }
    } else {
      filters.price = { $gte: 0, $lte: 200 };
    }

    // Badge filtering
    if (badge) {
      const badges = Array.isArray(badge) ? badge : [badge];
      filters.badge = { $in: badges };
    }

    // Sorting logic
    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { averageRating: -1 };

    // Pagination logic
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetching food items based on filters
    const foodItems = await Food.find(filters)
      .select('title description price slug coverImage badge')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Food.countDocuments(filters);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: foodItems,
    });
  } catch (err) {
    console.error('Error fetching food items:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



const ProductVariant = require('../models/ProductVariant');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const ProductSubcategory = require('../models/ProductSubcategory');

exports.getAllProducts = async (req, res) => {
  try {
    const {
      search = '',
      city,
      state,
      country,
      minorityType,
      categorySlug,
      categoryId,
      subcategorySlug,
      subcategoryId,
      businessId,
      sort,
      offers,
      page = 1,
      limit = 10,
      outOfStock = false,
      price,
      badge,
    } = req.query;

    const filters = { isDeleted: false, isPublished: true };

    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (minorityType) filters.minorityType = minorityType;
    if (city) filters['address.city'] = { $regex: city, $options: 'i' };
    if (state) filters['address.state'] = { $regex: state, $options: 'i' };
    if (country) filters['address.country'] = { $regex: country, $options: 'i' };
    if (businessId) filters.businessId = businessId;

    // Category filtering - accept both slug and ID
    if (categoryId) {
      filters.categoryId = categoryId;
    } else if (categorySlug) {
      const category = await ProductCategory.findOne({ slug: categorySlug });
      if (category) filters.categoryId = category._id;
      else return res.json({ success: true, total: 0, page: parseInt(page), totalPages: 0, data: [] });
    }

    // Subcategory filtering - accept both slug and ID
    if (subcategoryId) {
      filters.subcategoryId = subcategoryId;
    } else if (subcategorySlug) {
      const subcategory = await ProductSubcategory.findOne({ slug: subcategorySlug });
      if (subcategory) filters.subcategoryId = subcategory._id;
      else return res.json({ success: true, total: 0, page: parseInt(page), totalPages: 0, data: [] });
    }

    if (offers === 'true') filters.features = { $in: ['Offers Available'] };
    if (outOfStock === 'true') filters.stockQuantity = { $lte: 0 };

    // Price filtering
    if (price) {
      const priceRange = price.split('-');
      if (priceRange.length === 2) {
        const minPrice = parseFloat(priceRange[0]);
        const maxPrice = parseFloat(priceRange[1]);
        filters.price = { $gte: minPrice, $lte: maxPrice };
      }
    } else {
      // Default price range 0-200 when no price filter provided
      filters.price = { $gte: 0, $lte: 200 };
    }

    // Badge filtering
    if (badge) {
      const badges = Array.isArray(badge) ? badge : [badge];
      filters.badge = { $in: badges };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { averageRating: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let products = await Product.find(filters)
      .select('title description coverImage slug brand categoryId subcategoryId badge price')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Product.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages,
      data: products,
    });

  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.getProductsByFilters = async (req, res) => {
  try {
    const {
      categorySlug,
      categoryId,
      subcategorySlug,
      subcategoryId,
      search = '',
      city,
      state,
      country,
      minorityType,
      businessId,
      sort,
      offers,
      page = 1,
      limit = 10,
      outOfStock = false,
    } = req.query;

    const filters = { isDeleted: false, isPublished: true };

    // Category filtering - accept both slug and ID
    if (categoryId) {
      filters.categoryId = categoryId;
    } else if (categorySlug) {
      const category = await ProductCategory.findOne({ slug: categorySlug });
      if (category) filters.categoryId = category._id;
      else return res.json({ success: true, total: 0, data: [] });
    }

    // Subcategory filtering - accept both slug and ID
    if (subcategoryId) {
      filters.subcategoryId = subcategoryId;
    } else if (subcategorySlug) {
      const subcategory = await ProductSubcategory.findOne({ slug: subcategorySlug });
      if (subcategory) filters.subcategoryId = subcategory._id;
      else return res.json({ success: true, total: 0, data: [] });
    }

    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (minorityType) filters.minorityType = minorityType;
    if (city) filters['address.city'] = { $regex: city, $options: 'i' };
    if (state) filters['address.state'] = { $regex: state, $options: 'i' };
    if (country) filters['address.country'] = { $regex: country, $options: 'i' };
    if (businessId) filters.businessId = businessId;
    if (offers === 'true') filters.features = { $in: ['Offers Available'] };
    if (outOfStock === 'true') filters.stockQuantity = { $lte: 0 };

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { averageRating: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // First get products without populating variants to avoid ObjectId errors
    let products = await Product.find(filters)
      .select('title description coverImage variants slug')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Manually fetch variants for each product
    for (let product of products) {
      if (product.variants && product.variants.length > 0) {
        // Check if variants are ObjectIds (references) or embedded objects
        const firstVariant = product.variants[0];
        if (typeof firstVariant === 'string' || (firstVariant && firstVariant.toString)) {
          // Variants are references - fetch them
          try {
            // Filter out invalid ObjectIds
            const validVariantIds = product.variants.filter(id => {
              if (typeof id === 'string') {
                return /^[0-9a-fA-F]{24}$/.test(id); // Valid ObjectId format
              }
              return true;
            });
            
            if (validVariantIds.length > 0) {
              const variants = await ProductVariant.find({
                _id: { $in: validVariantIds },
                isPublished: true,
                isDeleted: false
              }).select('color price salePrice sku images videos totalReviews averageRating sizes').lean();
              
              product.variants = variants.map(variant => {
                if (Array.isArray(variant.sizes)) {
                  variant.sizes = variant.sizes.map(size => ({
                    ...size,
                    price: parseFloat(size?.price?.$numberDecimal || size?.price || 0),
                    salePrice: parseFloat(size?.salePrice?.$numberDecimal || size?.salePrice || 0),
                  }));
                }
                return variant;
              });
            } else {
              product.variants = [];
            }
          } catch (variantError) {
            console.log('Error fetching variants for product:', product._id, variantError.message);
            product.variants = [];
          }
        }
        // If variants are already embedded objects, keep them as is
      } else {
        product.variants = [];
      }
    }

    // Filter out products with no variants
    products = products.filter(product => product.variants && product.variants.length > 0);

    const total = await Product.countDocuments(filters);

    res.json({
      success: true,
      total: products.length,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: products,
    });

  } catch (err) {
    console.error('Error fetching products by filters:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};




// Route: /api/products/:productId

exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variants = await ProductVariant.find({ productId, isPublished: true, isDeleted: false })
      .select('color label price sku weightInKg images videos allowBackorder totalReviews averageRating sizes')
      .lean();

    res.json({
      success: true,
      data: {
        _id: product._id,
        title: product.title,
        description: product.description,
        brand: product.brand,
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId,
        businessId: product.businessId,
        coverImage: product.coverImage,
        specifications: product.specifications || [],
        isPublished: product.isPublished,
        variants: variants.map(variant => ({
          variantId: variant._id,
          color: variant.color,
          label: variant.label,
          allowBackorder: variant.allowBackorder,
          images: variant.images,
          videos: variant.videos,
          averageRating: variant.averageRating,
          totalReviews: variant.totalReviews,
          sizes: variant.sizes?.map((size) => ({
            sizeId: size._id,
            size: size.size,
            sku: size.sku,
            stock: size.stock,
            price: size.price ? Number(size.price) : 0,
            salePrice: size.salePrice ? Number(size.salePrice) : null,
            discountEndDate: size.discountEndDate ?? null,
          })) || [],
        }))
      }
    });

  } catch (err) {
    console.error('Error fetching product details:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


