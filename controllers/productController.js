const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { validationResult } = require('express-validator');
const deleteCloudinaryFile = require('../utils/deleteCloudinaryFile');
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


/**
 * Generate SKU for variant
 */
const generateSKU = (businessId, productId, attributes) => {
  const prefix = 'PRD';
  const businessCode = businessId.toString().slice(-4);
  const productCode = productId.toString().slice(-4);
  const attrString = Array.from(attributes.values()).join('-').replace(/\s/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${businessCode}-${productCode}-${attrString}-${random}`.toUpperCase();
};

/**
 * CREATE PRODUCT WITH VARIANTS
 */
/**
 * CREATE PRODUCT WITH VARIANTS
 */
exports.createProductWithVariants = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user._id;
    console.log('Creating product for user:', userId);
    const {
      title,
      description,
      categoryId,
      subcategoryId,
      businessId,
      attributes,
      shipping,
      coverImage,
      galleryImages,
      metaFields,
      discount,
      variants,
      isPublished,
    } = req.body;

    // Validate variants
    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'At least one product variant is required.' });
    }

    // ✅ Check business ownership ONLY - REMOVED isApproved check
    const business = await Business.findOne({ _id: businessId, owner: userId });
    if (!business) {
      return res.status(403).json({ error: 'You do not own this business.' });
    }

    // Check subscription
const subscription = await Subscription.findOne({
  userId: userId,  // ✅ Find by user ID
  status: 'active',
  endDate: { $gte: new Date() },
}).sort({ createdAt: -1 }); // Get the most recent one

if (!subscription) {
  return res.status(403).json({ 
    error: 'Valid subscription not found.',
    details: 'Please ensure you have an active subscription with completed payment.'
  });
}

    if (!subscription) {
      return res.status(403).json({ error: 'Valid subscription not found.' });
    }

    const subscriptionPlan = await SubscriptionPlan.findById(subscription.subscriptionPlanId);
    const productLimit = subscriptionPlan?.limits?.productListings || 0;

    // Count existing variants for the business
    const variantCount = await ProductVariant.countDocuments({ businessId, isDeleted: false });

    // Check if adding variants would exceed limit
    if (variantCount + variants.length > productLimit) {
      return res.status(403).json({
        error: `Product variant limit reached. You can add ${productLimit - variantCount} more variants.`,
      });
    }

    // Create Product
    const product = new Product({
      title,
      description,
      categoryId,
      subcategoryId,
      ownerId: userId,
      businessId,
      attributes: attributes || [],
      shipping: shipping || { standard: 0, overnight: 0, local: 0 },
      coverImage,
      galleryImages: galleryImages || [],
      metaFields: metaFields || [],
      discount: discount || null,
      isPublished: isPublished || false,
    });

    await product.save();

    // Create Variants
    const variantDocs = variants.map((variant) => ({
      productId: product._id,
      businessId,
      ownerId: userId,
      attributes: new Map(Object.entries(variant.attributes || {})),
      sku: variant.sku || generateSKU(businessId, product._id, new Map(Object.entries(variant.attributes || {}))),
      price: variant.price,
      salePrice: variant.salePrice,
      stock: variant.stock || 0,
      shipping: variant.shipping || null,
      images: variant.images || [],
      isPublished: isPublished || false,
    }));

    let savedVariants;
    try {
      savedVariants = await ProductVariant.insertMany(variantDocs);
      const variantIds = savedVariants.map((v) => v._id);
      await Product.findByIdAndUpdate(product._id, { $push: { variants: { $each: variantIds } } });
    } catch (variantErr) {
      // Rollback product creation
      await Product.findByIdAndDelete(product._id);
      if (coverImage) await deleteCloudinaryFile(coverImage);
      
      for (const variant of variants) {
        if (variant.images) {
          for (const image of variant.images) {
            await deleteCloudinaryFile(image);
          }
        }
      }
      
      return res.status(400).json({ 
        error: 'Error creating variants', 
        details: variantErr.message 
      });
    }

    return res.status(201).json({
      message: 'Product and variants created successfully.',
      product,
      variants: savedVariants,
    });

  } catch (err) {
    console.error('Error in product creation:', err);
    return res.status(500).json({ error: 'Server error while creating product.' });
  }
};

/**
 * GET PRODUCT BY ID with variants
 */
exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .lean();

    if (!product || product.isDeleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check ownership
    if (product.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get variants
    const variants = await ProductVariant.find({
      productId,
      isDeleted: false,
    }).lean();

    // Parse Decimal128 values
    const parsedProduct = {
      ...product,
      variants: variants.map(v => ({
        ...v,
        price: parseFloat(v.price?.toString() || '0'),
        salePrice: parseFloat(v.salePrice?.toString() || '0'),
      })),
    };

    return res.status(200).json({
      success: true,
      product: parsedProduct,
    });

  } catch (err) {
    console.error('Error in getProductById:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * UPDATE PRODUCT
 */
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const ownerId = req.user._id;
    const {
      title,
      description,
      categoryId,
      subcategoryId,
      attributes,
      shipping,
      coverImage,
      galleryImages,
      metaFields,
      discount,
      isPublished,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Handle cover image update
    if (coverImage && product.coverImage !== coverImage) {
      await deleteCloudinaryFile(product.coverImage);
    }

    // Update fields
    product.title = title || product.title;
    product.description = description || product.description;
    product.categoryId = categoryId || product.categoryId;
    product.subcategoryId = subcategoryId || product.subcategoryId;
    product.attributes = attributes || product.attributes;
    product.shipping = shipping || product.shipping;
    product.coverImage = coverImage || product.coverImage;
    product.galleryImages = galleryImages || product.galleryImages;
    product.metaFields = metaFields || product.metaFields;
    product.discount = discount || product.discount;
    product.isPublished = isPublished !== undefined ? isPublished : product.isPublished;

    await product.save();

    // Update variants publish status to match product
    if (isPublished !== undefined) {
      await ProductVariant.updateMany(
        { productId: product._id },
        { $set: { isPublished } }
      );
    }

    return res.status(200).json({
      message: 'Product updated successfully',
      product,
    });

  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE PRODUCT (Soft delete)
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Soft delete product
    product.isDeleted = true;
    await product.save();

    // Soft delete all variants
    await ProductVariant.updateMany(
      { productId },
      { $set: { isDeleted: true } }
    );

    return res.status(200).json({
      message: 'Product and variants deleted successfully',
    });

  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET ALL PRODUCTS for a business
 */
exports.getBusinessProducts = async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user._id;

    // Verify business ownership
    const business = await Business.findOne({ _id: businessId, owner: userId });
    if (!business) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const products = await Product.find({
      businessId,
      isDeleted: false,
    })
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Get variant counts and total stock for each product
    const productsWithDetails = await Promise.all(
      products.map(async (product) => {
        const variants = await ProductVariant.find({
          productId: product._id,
          isDeleted: false,
        }).lean();
        
        const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        const minPrice = variants.length > 0 
          ? Math.min(...variants.map(v => parseFloat(v.price?.toString() || 0)))
          : 0;
        const maxPrice = variants.length > 0
          ? Math.max(...variants.map(v => parseFloat(v.price?.toString() || 0)))
          : 0;

        return {
          ...product,
          variantCount: variants.length,
          totalStock,
          priceRange: {
            min: minPrice,
            max: maxPrice,
          },
        };
      })
    );

    return res.status(200).json({
      success: true,
      products: productsWithDetails,
    });

  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * ADD VARIANTS to existing product
 */
/**
 * ADD VARIANTS to existing product
 */
exports.addVariants = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId } = req.params;
    const { variants } = req.body;

    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check business exists
    const business = await Business.findById(product.businessId);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // ✅ FIXED: Find subscription by userId (not by business.subscriptionId)
    const subscription = await Subscription.findOne({
      userId: req.user._id,  // Find by user ID
      status: 'active',
      paymentStatus: { $in: ['PENDING', 'COMPLETED', 'PAID'] },
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(403).json({ 
        error: 'Valid subscription not found.',
        details: 'Please ensure you have an active subscription.'
      });
    }

    // Get subscription plan
    const subscriptionPlan = await SubscriptionPlan.findById(subscription.subscriptionPlanId);
    if (!subscriptionPlan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    const productLimit = subscriptionPlan?.limits?.productListings || 0;
    
    // Count existing variants
    const currentVariantCount = await ProductVariant.countDocuments({
      businessId: business._id,
      isDeleted: false,
    });

    // Check limit
    if (currentVariantCount + variants.length > productLimit) {
      return res.status(403).json({
        error: `Variant limit reached. You can add ${productLimit - currentVariantCount} more.`,
      });
    }

    // Create new variants with unique SKUs
    const variantDocs = variants.map((variant) => {
      // Generate unique SKU for each variant
      const attributeMap = new Map(Object.entries(variant.attributes || {}));
      const timestamp = Date.now();
      const random = Math.floor(1000 + Math.random() * 9000);
      const sku = variant.sku || `PRD-${timestamp}-${random}`;
      
      return {
        productId: product._id,
        businessId: business._id,
        ownerId: req.user._id,
        attributes: attributeMap,
        sku: sku,
        price: variant.price,
        salePrice: variant.salePrice,
        stock: variant.stock || 0,
        shipping: variant.shipping || null,
        images: variant.images || [],
        isPublished: product.isPublished,
      };
    });

    const savedVariants = await ProductVariant.insertMany(variantDocs);
    const variantIds = savedVariants.map(v => v._id);
    
    await Product.findByIdAndUpdate(productId, {
      $push: { variants: { $each: variantIds } },
    });

    return res.status(201).json({
      message: 'Variants added successfully',
      variants: savedVariants,
    });

  } catch (err) {
    console.error('Error adding variants:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * UPDATE VARIANT
 */
exports.updateVariant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, variantId } = req.params;
    const {
      attributes,
      sku,
      price,
      salePrice,
      stock,
      shipping,
      images,
      isPublished,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const variant = await ProductVariant.findOne({ _id: variantId, productId });
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Handle image cleanup if changed
    if (images && images.length > 0) {
      const oldImages = variant.images || [];
      const imagesToDelete = oldImages.filter(img => !images.includes(img));
      for (const oldImage of imagesToDelete) {
        await deleteCloudinaryFile(oldImage);
      }
    }

    // Update variant
    if (attributes) variant.attributes = new Map(Object.entries(attributes));
    if (sku) variant.sku = sku;
    if (price !== undefined) variant.price = price;
    if (salePrice !== undefined) variant.salePrice = salePrice;
    if (stock !== undefined) variant.stock = stock;
    if (shipping) variant.shipping = shipping;
    if (images) variant.images = images;
    if (isPublished !== undefined) variant.isPublished = isPublished;

    await variant.save();

    // Auto-publish/unpublish product based on variants
    if (isPublished === true && !product.isPublished) {
      product.isPublished = true;
      await product.save();
    } else if (isPublished === false) {
      const publishedVariants = await ProductVariant.countDocuments({
        productId,
        isPublished: true,
        isDeleted: false,
      });
      if (publishedVariants === 0) {
        product.isPublished = false;
        await product.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
      variant,
    });

  } catch (err) {
    console.error('Error updating variant:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * DELETE VARIANT (Soft delete)
 */
exports.deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const variant = await ProductVariant.findOne({ _id: variantId, productId });
    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Soft delete
    variant.isDeleted = true;
    await variant.save();

    // Remove from product's variants array
    product.variants = product.variants.filter(v => v.toString() !== variantId);
    
    // Check if any published variants remain
    const publishedVariants = await ProductVariant.countDocuments({
      productId,
      isPublished: true,
      isDeleted: false,
    });

    if (publishedVariants === 0) {
      product.isPublished = false;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Variant deleted successfully',
    });

  } catch (err) {
    console.error('Error deleting variant:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET VARIANT BY ID
 */
exports.getVariantById = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const variant = await ProductVariant.findOne({
      _id: variantId,
      productId,
      isDeleted: false,
    }).lean();

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // Parse Decimal128 values
    const parsedVariant = {
      ...variant,
      price: parseFloat(variant.price?.toString() || '0'),
      salePrice: parseFloat(variant.salePrice?.toString() || '0'),
    };

    return res.status(200).json({
      success: true,
      variant: parsedVariant,
    });

  } catch (err) {
    console.error('Error fetching variant:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * UPDATE VARIANT STOCK
 */
exports.updateVariantStock = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { stock, operation } = req.body; // operation: 'set', 'increment', 'decrement'

    const variant = await ProductVariant.findOne({
      _id: variantId,
      ownerId: req.user._id,
      isDeleted: false,
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    switch (operation) {
      case 'set':
        variant.stock = stock;
        break;
      case 'increment':
        variant.stock += stock;
        break;
      case 'decrement':
        if (variant.stock - stock < 0) {
          return res.status(400).json({ error: 'Insufficient stock' });
        }
        variant.stock -= stock;
        break;
      default:
        variant.stock = stock;
    }

    await variant.save();

    return res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      stock: variant.stock,
    });

  } catch (err) {
    console.error('Error updating stock:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};


exports.getProductUploadUrl = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fileName, fileType, documentType, productId, variantIndex } = req.query;

    if (!fileName || !fileType || !documentType) {
      return res.status(400).json({
        message: "fileName, fileType, and documentType are required",
      });
    }

    // Allowed product image types
    const allowedDocTypes = [
      "product-cover",     // Main product cover image
      "product-gallery",   // Product gallery images  
      "product-variant"    // Variant images
    ];

    if (!allowedDocTypes.includes(documentType)) {
      return res.status(400).json({
        message: "Invalid document type. Allowed: product-cover, product-gallery, product-variant",
      });
    }

    // Validate file type (images only)
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(fileType)) {
      return res.status(400).json({
        message: "Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)",
      });
    }

    const bucketName = process.env.AWS_S3_BUCKET;

    // Organize folder structure based on document type
    let folderPath;
    switch (documentType) {
      case "product-cover":
        folderPath = `products/${userId}/covers`;
        break;
      case "product-gallery":
        folderPath = `products/${userId}/gallery`;
        break;
      case "product-variant":
        // If productId and variantIndex provided, organize in variant-specific folder
        if (productId && variantIndex) {
          folderPath = `products/${userId}/${productId}/variants/${variantIndex}`;
        } else {
          folderPath = `products/${userId}/variants/temp`;
        }
        break;
      default:
        folderPath = `products/${userId}/temp`;
    }

    // Clean filename and add timestamp to prevent collisions
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const key = `${folderPath}/${timestamp}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    // Construct public URL
    const region = process.env.AWS_REGION || 'us-east-1';
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return res.json({
      success: true,
      uploadUrl,
      fileUrl,
      documentType,
      key,
      expiresIn: 300
    });

  } catch (error) {
    console.error("Presigned URL error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate upload URL",
    });
  }
};

exports.getVariantImageUploadUrl = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fileName, fileType, productId, variantSku } = req.query;

    if (!fileName || !fileType || !productId) {
      return res.status(400).json({
        message: "fileName, fileType, and productId are required",
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(fileType)) {
      return res.status(400).json({
        message: "Only image files are allowed",
      });
    }

    const bucketName = process.env.AWS_S3_BUCKET;

    // Create folder path with variant SKU if provided
    let folderPath;
    if (variantSku) {
      folderPath = `products/${userId}/${productId}/variants/${variantSku}`;
    } else {
      folderPath = `products/${userId}/${productId}/variants`;
    }

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const key = `${folderPath}/${timestamp}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });

    const region = process.env.AWS_REGION || 'us-east-1';
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return res.json({
      success: true,
      uploadUrl,
      fileUrl,
      key
    });

  } catch (error) {
    console.error("Variant image URL error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate variant image upload URL",
    });
  }
};
