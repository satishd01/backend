const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate presigned URL for Vendor Onboarding Stage-1 documents
 */
exports.getStage1UploadUrl = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fileName, fileType, documentType } = req.query;

    if (!fileName || !fileType || !documentType) {
      return res.status(400).json({
        message: "fileName, fileType, and documentType are required",
      });
    }

    const allowedDocTypes = [
      "minority-proof",
      "tax-doc",
      "business-license",
    ];

    if (!allowedDocTypes.includes(documentType)) {
      return res.status(400).json({
        message: "Invalid document type",
      });
    }

    const bucketName = process.env.AWS_S3_BUCKET;

    const key = `vendor-onboarding/stage1/${userId}/${documentType}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.json({
      uploadUrl,
      fileUrl,
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return res.status(500).json({
      message: "Failed to generate upload URL",
    });
  }
};
