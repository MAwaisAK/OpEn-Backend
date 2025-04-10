"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _images = require('../../models/images'); var _images2 = _interopRequireDefault(_images);
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);
var _tools = require('../../models/tools'); var _tools2 = _interopRequireDefault(_tools);
var _mytribes = require('../../models/mytribes'); var _mytribes2 = _interopRequireDefault(_mytribes);
var _courses = require('../../models/courses'); var _courses2 = _interopRequireDefault(_courses);
const Boom = require("boom");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const sharp = require("sharp");

// Initialize Firebase if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}
const bucket = admin.storage().bucket();

// Upload a file to Firebase Storage and return its public URL.
const handleFirebaseUpload = async (file, folder, nameFormat) => {
  const fileName = `${nameFormat}-${uuidv4()}-${file.originalname}`;
  const blob = bucket.file(`${folder}/${fileName}`);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      contentType: file.mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    blobStream.on("error", (error) => reject(error));
    blobStream.on("finish", () => {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        folder + "/" + fileName
      )}?alt=media`;
      resolve(publicUrl);
    });
    blobStream.end(file.buffer);
  });
};

// Delete a file from Firebase Storage using its public URL.
const deleteFromFirebase = async (photoUrl) => {
  try {
    console.log("Deleting file:", photoUrl);
    const decodedUrl = decodeURIComponent(photoUrl);
    const pathStartIndex = decodedUrl.indexOf("/o/") + 3;
    const pathEndIndex = decodedUrl.indexOf("?alt=media");
    const filePath = decodedUrl.slice(pathStartIndex, pathEndIndex);
    const file = bucket.file(filePath);
    await file.delete();
    console.log(`Deleted file: ${filePath}`);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

class ImageController {
  // Update the landing image field.
  // Expects one file in req.files.landingimg.
  static async updateLandingImage(req, res, next) {
    try {
      if (!req.files || !req.files.landingimg) {
        return next(Boom.badRequest("No landing image file provided."));
      }
      const file = req.files.landingimg[0];
      // Optionally resize using sharp here if needed.
      const uploadedUrl = await handleFirebaseUpload(file, "LandingPhotos", "landing");
      
      let imageDoc = await _images2.default.findOne();
      if (!imageDoc) {
        imageDoc = new (0, _images2.default)();
      }
      // Delete previous image if exists.
      if (imageDoc.landingimg) {
        await deleteFromFirebase(imageDoc.landingimg);
      }
      imageDoc.landingimg = uploadedUrl;
      await imageDoc.save();
      res.json(imageDoc);
    } catch (error) {
      console.error("Error updating landing image:", error);
      next(Boom.internal("Error updating landing image", error));
    }
  }

  // Update the landing mini image field.
  // Expects one file in req.files.landingminiimg.
  static async updateLandingMiniImage(req, res, next) {
    try {
      if (!req.files || !req.files.landingminiimg) {
        return next(Boom.badRequest("No landing mini image file provided."));
      }
      const file = req.files.landingminiimg[0];
      const uploadedUrl = await handleFirebaseUpload(file, "LandingMiniPhotos", "landingmini");

      let imageDoc = await _images2.default.findOne();
      if (!imageDoc) {
        imageDoc = new (0, _images2.default)();
      }
      if (imageDoc.landingminiimg) {
        await deleteFromFirebase(imageDoc.landingminiimg);
      }
      imageDoc.landingminiimg = uploadedUrl;
      await imageDoc.save();
      res.json(imageDoc);
    } catch (error) {
      console.error("Error updating landing mini image:", error);
      next(Boom.internal("Error updating landing mini image", error));
    }
  }

  static async updateDashboardImage(req, res, next) {
    try {
      if (!req.files || !req.files.dashboardimg) {
        return next(Boom.badRequest("No landing mini image file provided."));
      }
      const file = req.files.dashboardimg[0];
      const uploadedUrl = await handleFirebaseUpload(file, "dashboardimg", "dashboardimg");

      let imageDoc = await _images2.default.findOne();
      if (!imageDoc) {
        imageDoc = new (0, _images2.default)();
      }
      if (imageDoc.dashboardimg) {
        await deleteFromFirebase(imageDoc.dashboardimg);
      }
      imageDoc.dashboardimg = uploadedUrl;
      await imageDoc.save();
      res.json(imageDoc);
    } catch (error) {
      console.error("Error updating landing mini image:", error);
      next(Boom.internal("Error updating landing mini image", error));
    }
  }

  // Get the landing image.
  static async getLandingImage(req, res, next) {
    try {
      const imageDoc = await _images2.default.findOne();
      if (!imageDoc || !imageDoc.landingimg) {
        return next(Boom.notFound("Landing image not found."));
      }
      res.json({ landingimg: imageDoc.landingimg });
    } catch (error) {
      console.error("Error fetching landing image:", error);
      next(Boom.internal("Error fetching landing image", error));
    }
  }

  // Get the landing mini image.
  static async getLandingMiniImage(req, res, next) {
    try {
      const imageDoc = await _images2.default.findOne();
      if (!imageDoc || !imageDoc.landingminiimg) {
        return next(Boom.notFound("Landing mini image not found."));
      }
      res.json({ landingminiimg: imageDoc.landingminiimg });
    } catch (error) {
      console.error("Error fetching landing mini image:", error);
      next(Boom.internal("Error fetching landing mini image", error));
    }
  }

  // Optionally, get the dashboard image.
  static async getDashboardImage(req, res, next) {
    try {
      const imageDoc = await _images2.default.findOne();
      if (!imageDoc || !imageDoc.dashboardimg) {
        return next(Boom.notFound("Dashboard image not found."));
      }
      res.json({ dashboardimg: imageDoc.dashboardimg });
    } catch (error) {
      console.error("Error fetching dashboard image:", error);
      next(Boom.internal("Error fetching dashboard image", error));
    }
  }

  static async getDashboardStats(req, res, next) {
    try {
      // Count total users
      const userCount = await _user2.default.countDocuments();

      // Count total mytribes
      const tools = await _tools2.default.countDocuments();

      // Sum tokens_used from all user prompts
      const myTribesCount = await _mytribes2.default.countDocuments();

      // Count total courses
      const coursesCount = await _courses2.default.countDocuments();

      // Return aggregated statistics
      res.json({
        userCount,
        myTribesCount,
        tools,
        coursesCount,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      next(Boom.internal("Error fetching dashboard stats", error));
    }
  }
}

module.exports = ImageController;
