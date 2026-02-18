const Service = require('../models/Service');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PendingImage = require('../models/PendingImage');
const deleteCloudinaryFile = require('../utils/deleteCloudinaryFile');
const { S3Client } = require('@aws-sdk/client-s3');
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

require('../models/ServiceCategory');
require('../models/ServiceSubcategory');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

exports.createService = async (req, res) => {
  const session = await Service.startSession();
  session.startTransaction();
  
  try {
    const {
      categoryId,
      subcategoryId,
      businessId,
      bookingToolLink,
      services,
      coverImage,
      images,
      businessHours,
      location,
      isPublished,
    } = req.body;

    const userId = req.user._id;

    // 🛡️ Step 1: Verify ownership
    const business = await Business.findOne({ _id: businessId, owner: userId });
    if (!business)
      return res.status(403).json({ error: 'You do not own this business.' });

    if (!business.isApproved)
      return res.status(400).json({ error: 'Business is not approved yet.' });

    if (business.listingType !== 'service')
      return res.status(400).json({ error: 'This business is not allowed to list services.' });

    // 📅 Step 2: Subscription check
    const subscription = await Subscription.findOne({
      userId: userId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    if (!subscription)
      return res.status(403).json({ error: 'Valid subscription not found.' });

    const subscriptionPlan = await SubscriptionPlan.findById(subscription.subscriptionPlanId);
    const serviceLimit = subscriptionPlan?.limits?.serviceListings || 0;

    const existingServiceCount = await Service.countDocuments({ ownerId: userId });

    if (existingServiceCount >= serviceLimit) {
      return res.status(403).json({
        error: `Service listing limit reached for your subscription. You can add up to ${serviceLimit} services.`,
      });
    }

    // ✅ Step 3: Save service with defaults for optional fields
    const service = new Service({
      // Default values for required fields
      title: 'Service',
      description: '',
      price: 0,
      duration: '60 minutes',
      
      // Your actual data
      categoryId,
      subcategoryId,
      businessId,
      bookingToolLink: bookingToolLink || '',
      services: services || [],
      coverImage: coverImage || '',
      images: images || [],
      isPublished: isPublished || false,
      businessHours: businessHours || [],
      location: location?.address || '',
      
      // Default contact
      contact: {
        phone: '',
        email: '',
        address: location?.address || '',
        website: ''
      },
      
      ownerId: userId,
      minorityType: business.minorityType,
      maxBookingsPerSlot: 1,
      features: [],
      amenities: [],
      videos: [],
      faq: []
    });

    await service.save();

    // Clean up pending images
    const usedImages = [coverImage, ...(images || [])].filter(Boolean);
    if (usedImages.length > 0) {
      await PendingImage.deleteMany({ url: { $in: usedImages } });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Service created successfully.',
      service,
    });
    
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    // Clean up uploaded images on error
    const usedImages = [req.body.coverImage, ...(req.body.images || [])].filter(Boolean);
    for (const image of usedImages) {
      await deleteCloudinaryFile(image).catch(() => {});
      await PendingImage.deleteOne({ url: image }).catch(() => {});
    }

    console.error('Service creation failed:', err.message);
    return res.status(400).json({ error: err.message || 'Failed to create service' });
  }
};

// Other functions remain the same but with updated field references
exports.getMyServices = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const isPublished = req.query.isPublished;
    const categoryId = req.query.categoryId;

    const filters = { ownerId: userId };

    if (isPublished === 'true') filters.isPublished = true;
    if (isPublished === 'false') filters.isPublished = false;
    if (categoryId) filters.categoryId = categoryId;

    const services = await Service.find(filters)
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Service.countDocuments(filters);

    res.status(200).json({
      services,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error('Failed to fetch user services:', err.message);
    res.status(500).json({ error: err.message || 'Failed to retrieve services.' });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user._id;

    const service = await Service.findOne({ _id: serviceId, ownerId: userId });
    if (!service)
      return res.status(404).json({ error: 'Service not found or unauthorized.' });

    const usedImages = [service.coverImage, ...service.images].filter(Boolean);
    for (const image of usedImages) {
      await deleteCloudinaryFile(image).catch(() => {});
    }

    await service.deleteOne();

    res.status(200).json({ message: 'Service deleted successfully.' });
    
  } catch (err) {
    console.error('Failed to delete service:', err.message);
    res.status(500).json({ error: 'Failed to delete service.' });
  }
};

exports.updateService = async (req, res) => {
  try {
    const userId = req.user._id;
    const serviceId = req.params.id;

    const service = await Service.findOne({ _id: serviceId, ownerId: userId });
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Handle image updates
    if (req.body.coverImage && req.body.coverImage !== service.coverImage) {
      await deleteCloudinaryFile(service.coverImage).catch(() => {});
    }

    if (Array.isArray(req.body.images) && Array.isArray(service.images)) {
      const removedImages = service.images.filter(img => !req.body.images.includes(img));
      for (const image of removedImages) {
        await deleteCloudinaryFile(image).catch(() => {});
      }
    }

    // Update allowed fields
    const updatableFields = [
      'title', 'description', 'price', 'duration', 'services', 'isPublished',
      'coverImage', 'images', 'features', 'amenities', 'businessHours',
      'bookingToolLink', 'maxBookingsPerSlot', 'location', 'contact'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        service[field] = req.body[field];
      }
    });

    // Handle location as string
    if (req.body.location?.address) {
      service.location = req.body.location.address;
      if (service.contact) {
        service.contact.address = req.body.location.address;
      }
    }

    await service.save();

    res.status(200).json({
      message: 'Service updated successfully',
      service
    });
    
  } catch (error) {
    console.error('Service update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const userId = req.user._id;
    const serviceId = req.params.id;

    const service = await Service.findOne({
      _id: serviceId,
      ownerId: userId
    })
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('ownerId', 'name email');

    if (!service) {
      return res.status(404).json({
        message: 'Service not found or unauthorized.'
      });
    }

    res.status(200).json({ service });

  } catch (err) {
    console.error('Failed to fetch service:', err.message);
    res.status(500).json({
      message: 'Internal server error'
    });
  }
};



exports.getServiceUploadUrl = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fileName, fileType, documentType, serviceId } = req.query;

    if (!fileName || !fileType || !documentType) {
      return res.status(400).json({
        message: "fileName, fileType, and documentType are required",
      });
    }

    // Allowed service image types
    const allowedDocTypes = [
      "service-cover",     // Main service cover/banner image
      "service-gallery"    // Service gallery images
    ];

    if (!allowedDocTypes.includes(documentType)) {
      return res.status(400).json({
        message: "Invalid document type. Allowed: service-cover, service-gallery",
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
      case "service-cover":
        // If serviceId provided, organize in service-specific folder
        if (serviceId) {
          folderPath = `services/${userId}/${serviceId}/cover`;
        } else {
          folderPath = `services/${userId}/covers/temp`;
        }
        break;
      case "service-gallery":
        if (serviceId) {
          folderPath = `services/${userId}/${serviceId}/gallery`;
        } else {
          folderPath = `services/${userId}/gallery/temp`;
        }
        break;
      default:
        folderPath = `services/${userId}/temp`;
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