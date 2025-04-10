"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _mytribes = require('../../models/mytribes'); var _mytribes2 = _interopRequireDefault(_mytribes);
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);
var _notifications = require('../../models/notifications'); var _notifications2 = _interopRequireDefault(_notifications);
var _uuid = require('uuid');
var _firebaseadmin = require('firebase-admin'); var _firebaseadmin2 = _interopRequireDefault(_firebaseadmin);

// Initialize Firebase (if not already initialized)
if (!_firebaseadmin2.default.apps.length) {
  _firebaseadmin2.default.initializeApp({
    credential: _firebaseadmin2.default.credential.cert({
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
const bucket = _firebaseadmin2.default.storage().bucket();

// Helper: Upload file to Firebase and return public URL.
const handleFirebaseUpload = async (file, folder, nameFormat) => {
  const fileName = `${nameFormat}-${_uuid.v4.call(void 0, )}-${file.originalname}`;
  const blob = bucket.file(`${folder}/${fileName}`);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: { contentType: file.mimetype },
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

// Helper: Delete file from Firebase using its public URL.
 const deleteFromFirebase = async (photoUrl) => {
  try {
    console.log(`Deleting file: ${photoUrl}`);
    const decodedUrl = decodeURIComponent(photoUrl);
    const pathStartIndex = decodedUrl.indexOf("/o/") + 3;
    const pathEndIndex = decodedUrl.indexOf("?alt=media");
    const filePath = decodedUrl.slice(pathStartIndex, pathEndIndex);
    const file = bucket.file(filePath);
    await file.delete();
    console.log(`Successfully deleted ${filePath} from Firebase Storage.`);
  } catch (error) {
    console.error("Error deleting file from Firebase Storage:", error);
  }
}; exports.deleteFromFirebase = deleteFromFirebase;

//
// Mytribe Controller functions
//

/**
 * Create a new Mytribe.
 * Expects thumbnail and banner file uploads.
 * A unique tribechat ID is generated.
 */
 const createMytribe = async (req, res, next) => {
  try {
    const {
      title,
      shortDescription,
      longDescription,
      tribeCategory,
      //joinPolicy,
      //membersLimit,
    } = req.body;
    
    // Parse admins and members if provided as JSON strings.
    const admins = req.body.admins ? JSON.parse(req.body.admins) : [];
    const members = req.body.members ? JSON.parse(req.body.members) : [];

    // Upload thumbnail.
    let thumbnailUrl;
    if (req.files && req.files["thumbnail"]) {
      thumbnailUrl = await handleFirebaseUpload(
        req.files["thumbnail"][0],
        "Thumbnail",
        `Mytribe-${title}-thumbnail`
      );
    } else {
      return next(_boom2.default.badRequest("Thumbnail file is required."));
    }

    // Upload banner.
    let bannerUrl;
    if (req.files && req.files["banner"]) {
      bannerUrl = await handleFirebaseUpload(
        req.files["banner"][0],
        "Banner",
        `Mytribe-${title}-banner`
      );
    } else {
      return next(_boom2.default.badRequest("Banner file is required."));
    }

    // Create a new Mytribe instance. Mongoose automatically generates _id.
    const mytribe = new (0, _mytribes2.default)({
      title,
      shortDescription,
      longDescription,
      tribeCategory,
      //joinPolicy,
      //membersLimit,
      admins,
      members,
      thumbnail: thumbnailUrl,
      banner: bannerUrl,
    });
    
    // Set tribechat to the string representation of the document's _id.
    mytribe.tribechat = mytribe._id.toString();

    const savedMytribe = await mytribe.save();

    // --- Notification Logic for Tribe Creation ---
    // Prepare notification data for tribe creation.
    const notificationData = `New tribe '${title}' has been created.`;
    // Retrieve all users' IDs so that they all receive the notification.
    const users = await _user2.default.find({}, "_id");

    if (users.length) {
      // Create bulk operations for each user.
      const bulkOperations = users.map(user => ({
        updateOne: {
          filter: { user: user._id },
          update: {
            $setOnInsert: { user: user._id },
            $push: {
              type: { $each: ["tribecreate"] },
              data: { $each: [notificationData] }
            }
          },
          upsert: true
        }
      }));

      await _notifications2.default.bulkWrite(bulkOperations);
      console.log("Sent tribe creation notification to all users.");
    } else {
      console.warn("No users found to send tribe creation notification.");
    }
    // --- End Notification Logic ---

    res.status(201).json(savedMytribe);
  } catch (error) {
    console.error("Error creating mytribe:", error);
    next(_boom2.default.internal("Error creating mytribe."));
  }
}; exports.createMytribe = createMytribe;


/**
 * Update an existing Mytribe by ID.
 * Can update basic fields and optionally handle new thumbnail/banner uploads.
 */
 const updateMytribe = async (req, res, next) => {
  try {
    const { mytribeId } = req.params;
    const updateData = req.body;

    // Optionally, if files are provided, handle file updates.
    if (req.files) {
      if (req.files["thumbnail"]) {
        const file = req.files["thumbnail"][0];
        const uploadedUrl = await handleFirebaseUpload(
          file,
          "Thumbnail",
          `Mytribe-${updateData.title || "updated"}-thumbnail`
        );
        updateData.thumbnail = uploadedUrl;
      }
      if (req.files["banner"]) {
        const file = req.files["banner"][0];
        const uploadedUrl = await handleFirebaseUpload(
          file,
          "Banner",
          `Mytribe-${updateData.title || "updated"}-banner`
        );
        updateData.banner = uploadedUrl;
      }
    }

    const updatedMytribe = await _mytribes2.default.findByIdAndUpdate(mytribeId, updateData, { new: true });
    if (!updatedMytribe) {
      return next(_boom2.default.notFound("Mytribe not found."));
    }
    res.json(updatedMytribe);
  } catch (error) {
    console.error("Error updating mytribe:", error);
    next(_boom2.default.internal("Error updating mytribe."));
  }
}; exports.updateMytribe = updateMytribe;

/**
 * Delete an existing Mytribe by ID.
 * Optionally deletes associated thumbnail and banner from Firebase.
 */
 const deleteMytribe = async (req, res, next) => {
  try {
    const { mytribeId } = req.params;
    const mytribe = await _mytribes2.default.findById(mytribeId);
    if (!mytribe) {
      return next(_boom2.default.notFound("Mytribe not found."));
    }
    // Delete thumbnail and banner from Firebase if they exist.
    if (mytribe.thumbnail) {
      await exports.deleteFromFirebase.call(void 0, mytribe.thumbnail);
    }
    if (mytribe.banner) {
      await exports.deleteFromFirebase.call(void 0, mytribe.banner);
    }
    // Delete the Mytribe document from the collection.
    await _mytribes2.default.findByIdAndDelete(mytribeId);

    // Remove the tribe reference from all users' joined_tribes arrays.
    await _user2.default.updateMany(
      { joined_tribes: mytribeId },
      { $pull: { joined_tribes: mytribeId } }
    );
    console.log(`Removed mytribe ${mytribeId} from all users' joined_tribes.`);
    
    res.json({ message: "Mytribe deleted successfully." });
  } catch (error) {
    console.error("Error deleting mytribe:", error);
    next(_boom2.default.internal("Error deleting mytribe."));
  }
}; exports.deleteMytribe = deleteMytribe;

/**
 * Fetch all tribes for a given user.
 * Retrieves tribes where the user is either a member or an admin.
 * Selects specific fields and computes the total number of members.
 */
 const getUserTribes = async (req, res, next) => {
  try {
    // Retrieve user id (assumes req.user is set by your auth middleware)
    const userId = req.user && req.user._id;
    if (!userId) {
      return next(_boom2.default.badRequest("User ID is required."));
    }

    // Find tribes where the user is a member or an admin.
    const tribes = await _mytribes2.default.find({
      $or: [
        { members: userId },
        { admins: userId },
      ],
    }).select("title admins shortDescription longDescription status thumbnail banner ratings members createdAt");

    // Map over the tribes to calculate the total number of members and format the response.
    const tribesWithTotalMembers = tribes.map(tribe => ({
      title: tribe.title,
      admins: tribe.admins,
      shortDescription: tribe.shortDescription,
      longDescription: tribe.longDescription,
      status: tribe.status,
      thumbnail: tribe.thumbnail,
      banner: tribe.banner,
      ratings: tribe.ratings,
      totalMembers: Array.isArray(tribe.members) ? tribe.members.length : 0,
      createdAt: tribe.createdAt,  // Include createdAt timestamp
    }));

    res.json(tribesWithTotalMembers);
  } catch (error) {
    console.error("Error fetching user tribes:", error);
    next(_boom2.default.internal("Error fetching user tribes."));
  }
}; exports.getUserTribes = getUserTribes;

/**
 * Get a Mytribe by its ID.
 */
 const getMytribeById = async (req, res, next) => {
  try {
    const { mytribeId } = req.params;
    const mytribe = await _mytribes2.default.findById(mytribeId)
      .populate("members")
      .populate("admins");
    if (!mytribe) {
      return next(_boom2.default.notFound("Mytribe not found."));
    }
    res.json(mytribe);
  } catch (error) {
    console.error("Error fetching mytribe:", error);
    next(_boom2.default.internal("Error fetching mytribe."));
  }
}; exports.getMytribeById = getMytribeById;

/**
 * Get all Mytribes.
 */
 const getAllMytribes = async (req, res, next) => {
  try {
    const mytribes = await _mytribes2.default.find({})
      .populate("members")
      .populate("admins");
    res.json(mytribes);
  } catch (error) {
    console.error("Error fetching mytribes:", error);
    next(_boom2.default.internal("Error fetching mytribes."));
  }
}; exports.getAllMytribes = getAllMytribes;

 const getUsersMytribes = async (req, res, next) => {
  try {
    const tribes = await _mytribes2.default.find({})
      .populate("members")
      .populate("admins");

    const tribesWithTotalMembers = tribes.map(tribe => ({
      id: tribe._id,
      title: tribe.title,
      admins: tribe.admins,
      shortDescription: tribe.shortDescription,
      longDescription: tribe.longDescription,
      status: tribe.status,
      thumbnail: tribe.thumbnail,
      banner: tribe.banner,
      ratings: tribe.ratings,
      tribeCategory: tribe.tribeCategory,
      totalMembers: Array.isArray(tribe.members) ? tribe.members.length : 0,
      createdAt: tribe.createdAt,
    }));

    res.json(tribesWithTotalMembers);
  } catch (error) {
    console.error("Error fetching mytribes:", error);
    next(_boom2.default.internal("Error fetching mytribes."));
  }
}; exports.getUsersMytribes = getUsersMytribes;

 const getSpecificMytribes = async (req, res, next) => {
  try {
    const { userId } = req.params; // Get userId from route parameters

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Find tribes where the user is either a member or an admin.
    const tribes = await _mytribes2.default.find({
      $or: [{ members: userId }, { admins: userId }]
    })
      .populate("members")
      .populate("admins");

    // Map over tribes to add computed average rating (based on latest rating per unique user),
    // total members, and other relevant fields.
    const tribesWithTotalMembers = tribes.map(tribe => {
      let computedRating = 0;
      if (Array.isArray(tribe.ratings) && tribe.ratings.length > 0) {
        // Create a map for unique user ratings (keeping the rating with the latest _id)
        const ratingsMap = {};
        tribe.ratings.forEach(r => {
          const uid = r.userId.toString();
          // Update if no rating exists for this user or current rating _id is less than new rating _id.
          if (!ratingsMap[uid] || r._id.toString() > ratingsMap[uid]._id.toString()) {
            ratingsMap[uid] = r;
          }
        });
        const uniqueRatings = Object.values(ratingsMap);
        const sum = uniqueRatings.reduce((acc, r) => acc + r.rating, 0);
        computedRating = uniqueRatings.length > 0 ? sum / uniqueRatings.length : 0;
      }

      return {
        id: tribe._id,
        title: tribe.title,
        admins: tribe.admins,
        shortDescription: tribe.shortDescription,
        longDescription: tribe.longDescription,
        status: tribe.status,
        thumbnail: tribe.thumbnail,
        banner: tribe.banner,
        ratings: computedRating, // Computed average rating.
        tribeCategory: tribe.tribeCategory,
        totalMembers: Array.isArray(tribe.members) ? tribe.members.length : 0,
        createdAt: tribe.createdAt,
      };
    });

    res.json(tribesWithTotalMembers);
  } catch (error) {
    console.error("Error fetching mytribes for user:", error);
    next(_boom2.default.internal("Error fetching mytribes."));
  }
}; exports.getSpecificMytribes = getSpecificMytribes;


/**
 * Get total number of members for a given Mytribe.
 * Returns an object with the mytribe ID and member count.
 */
 const getTotalMembers = async (req, res, next) => {
  try {
    const { mytribeId } = req.params;
    const mytribe = await _mytribes2.default.findById(mytribeId);
    if (!mytribe) {
      return next(_boom2.default.notFound("Mytribe not found."));
    }
    const totalMembers = mytribe.members.length;
    res.json({ mytribeId, totalMembers });
  } catch (error) {
    console.error("Error fetching total members:", error);
    next(_boom2.default.internal("Error fetching total members."));
  }
}; exports.getTotalMembers = getTotalMembers;

/**
 * Update tribe status for one or multiple tribes.
 * Expects req.body to include:
 * - tribeIds: an array of tribe IDs to update.
 * - newStatus: a boolean indicating the new status.
 */
 const updateTribeStatus = async (req, res, next) => {
  try {
    const { tribeIds, newStatus } = req.body;
    if (!Array.isArray(tribeIds) || typeof newStatus !== "boolean") {
      return next(
        _boom2.default.badRequest(
          "Invalid input. 'tribeIds' should be an array and 'newStatus' should be a boolean."
        )
      );
    }

    // Update the status field for all tribes with IDs in tribeIds array.
    const result = await _mytribes2.default.updateMany(
      { _id: { $in: tribeIds } },
      { $set: { status: newStatus } }
    );

    res.json({
      message: "Tribe status updated successfully.",
      result,
    });
  } catch (error) {
    console.error("Error updating tribe status:", error);
    next(_boom2.default.internal("Error updating tribe status."));
  }
}; exports.updateTribeStatus = updateTribeStatus;

 const getTribes = async (req, res, next) => {
  try {
    // Ensure the user is authenticated (req.user is set by your auth middleware)
    const userId = req.user && req.user._id;
    if (!userId) {
      return next(_boom2.default.badRequest("User ID is required."));
    }

    // Find tribes where the user is a member or an admin.
    const tribes = await _mytribes2.default.find({
      $or: [
        { members: userId },
        { admins: userId },
      ],
    }).select("title admins shortDescription longDescription status thumbnail banner rating members createdAt");

    // Map over the tribes to calculate the total number of members.
    const tribesWithTotalMembers = tribes.map(tribe => ({
      title: tribe.title,
      admins: tribe.admins,
      shortDescription: tribe.shortDescription,
      longDescription: tribe.longDescription,
      status: tribe.status,
      thumbnail: tribe.thumbnail,
      banner: tribe.banner,
      rating: tribe.ratings,
      totalMembers: Array.isArray(tribe.members) ? tribe.members.length : 0,
      createdAt: tribe.createdAt,
    }));

    res.json(tribesWithTotalMembers);
  } catch (error) {
    console.error("Error fetching user tribes:", error);
    next(_boom2.default.internal("Error fetching user tribes."));
  }
}; exports.getTribes = getTribes;

 const joinTribe = async (req, res, next) => {
  try {
    const { userId, tribeId } = req.body;
    console.log("UserID:", userId);
    console.log("TribeID:", tribeId);

    if (!userId) {
      return next(_boom2.default.unauthorized("User must be logged in."));
    }
    if (!tribeId) {
      return next(_boom2.default.badRequest("Tribe ID is required."));
    }

    // Update user's joined_tribes using $addToSet to avoid duplicates.
    const user = await _user2.default.findByIdAndUpdate(
      userId,
      { $addToSet: { joined_tribes: tribeId } },
      { new: true }
    );
    if (!user) {
      return next(_boom2.default.notFound("User not found."));
    }

    // Update tribe's members using $addToSet to avoid duplicates.
    const tribe = await _mytribes2.default.findByIdAndUpdate(
      tribeId,
      { $addToSet: { members: userId } },
      { new: true }
    );
    if (!tribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    res.json({ message: "Successfully joined the tribe.", user, tribe });
  } catch (error) {
    console.error("Error joining tribe:", error);
    next(_boom2.default.internal("Error joining tribe."));
  }
}; exports.joinTribe = joinTribe;

/**
 * Leave a tribe.
 * Expects req.body.tribeId.
 * Removes tribeId from the user's joined_tribes and userId from the tribe's members.
 */
 const leaveTribe = async (req, res, next) => {
  try {
    const { tribeId,userId } = req.body;
    if (!userId) {
      return next(_boom2.default.unauthorized("User must be logged in."));
    }
    if (!tribeId) {
      return next(_boom2.default.badRequest("Tribe ID is required."));
    }

    // Remove tribeId from user's joined_tribes.
    const updatedUser = await _user2.default.findByIdAndUpdate(
      userId,
      { $pull: { joined_tribes: tribeId } },
      { new: true }
    );
    if (!updatedUser) {
      return next(_boom2.default.notFound("User not found."));
    }

    // Remove userId from tribe's members.
    const updatedTribe = await _mytribes2.default.findByIdAndUpdate(
      tribeId,
      { $pull: { members: userId } },
      { new: true }
    );
    if (!updatedTribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    res.json({ message: "Successfully left the tribe.", user: updatedUser, tribe: updatedTribe });
  } catch (error) {
    console.error("Error leaving tribe:", error);
    next(_boom2.default.internal("Error leaving tribe."));
  }
}; exports.leaveTribe = leaveTribe;

/**
 * Get tribe members.
 * Expects req.params.tribeId.
 * Returns the tribe's members (populated).
 */
 const getTribeMembers = async (req, res, next) => {
  try {
    const { tribeId } = req.params;
    if (!tribeId) {
      return next(_boom2.default.badRequest("Tribe ID is required."));
    }

    const tribe = await _mytribes2.default.findById(tribeId).populate("members");
    if (!tribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    res.json({ tribeId, members: tribe.members });
  } catch (error) {
    console.error("Error fetching tribe members:", error);
    next(_boom2.default.internal("Error fetching tribe members."));
  }
}; exports.getTribeMembers = getTribeMembers;

/**
 * Remove a member from a tribe.
 * Expects req.body.tribeId and req.body.memberId.
 * Removes memberId from the tribe's members array and optionally from the user's joined_tribes.
 */
 const removeMemberFromTribe = async (req, res, next) => {
  try {
    const { tribeId, memberId } = req.body;
    if (!tribeId || !memberId) {
      return next(_boom2.default.badRequest("Tribe ID and Member ID are required."));
    }

    // Remove the member from the tribe's members array.
    const updatedTribe = await _mytribes2.default.findByIdAndUpdate(
      tribeId,
      { $pull: { members: memberId } },
      { new: true }
    );
    if (!updatedTribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    // Optionally, remove the tribe from the user's joined_tribes array.
    const updatedUser = await _user2.default.findByIdAndUpdate(
      memberId,
      { $pull: { joined_tribes: tribeId } },
      { new: true }
    );

    res.json({ message: "Member removed from tribe.", tribe: updatedTribe, user: updatedUser });
  } catch (error) {
    console.error("Error removing member from tribe:", error);
    next(_boom2.default.internal("Error removing member from tribe."));
  }
}; exports.removeMemberFromTribe = removeMemberFromTribe;

 const getTribeForUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const tribes = await _mytribes2.default.find({
      $or: [
        { members: userId },
        { admins: userId }
      ]
    })
      .populate("members")
      .populate("admins")
      .populate("ratings");

    if (!tribes.length) {
      return next(_boom2.default.notFound("No tribes found for this user."));
    }

    res.json(tribes);
  } catch (error) {
    console.error("Error fetching tribes for user:", error);
    next(_boom2.default.internal("Error fetching tribes for user."));
  }
}; exports.getTribeForUser = getTribeForUser;
 const getTribeById = async (req, res, next) => {
  try {
    const { tribeId } = req.params;
    console.log("Hi");
    const tribe = await _mytribes2.default.findById(tribeId)
      .select('title members admins shortDescription longDescription ratings blockedUsers messageSettings thumbnail banner tribeCategory')
      .populate("members", "username firstName lastName profile_pic")
      .populate("admins", "username firstName lastName profile_pic")
      .populate("ratings.userId", "username firstName lastName profile_pic")
      .populate("blockedUsers", "username firstName lastName profile_pic");

    if (!tribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    res.json(tribe);
  } catch (error) {
    console.error("Error fetching tribe:", error);
    next(_boom2.default.internal("Error fetching tribe."));
  }
}; exports.getTribeById = getTribeById;

 const rateTribe = async (req, res, next) => {
  try {
    const { tribeId } = req.params;
    const { userId, rating } = req.body;

    // Check if the rating is between 1 and 5
    if (rating < 1 || rating > 5) {
      return next(_boom2.default.badRequest("Rating must be between 1 and 5."));
    }

    // Find the tribe and update the rating
    const tribe = await _mytribes2.default.findById(tribeId);
    if (!tribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    // Check if the user has already rated the tribe
    const existingRating = tribe.ratings.find(r => r.userId.toString() === userId);
    if (existingRating) {
      existingRating.rating = rating; // Update rating if exists
    } else {
      tribe.ratings.push({ userId, rating }); // Add new rating
    }

    // Save the updated tribe
    await tribe.save();

    res.json({ message: "Tribe rated successfully." });
  } catch (error) {
    console.error("Error rating tribe:", error);
    next(_boom2.default.internal("Error rating tribe."));
  }
}; exports.rateTribe = rateTribe;

 const blockUserFromTribe = async (req, res, next) => {
  try {
    const { tribeId, userId } = req.params;

    // Find the tribe and check if it exists
    const tribe = await _mytribes2.default.findById(tribeId);
    if (!tribe) {
      return next(_boom2.default.notFound("Tribe not found."));
    }

    // Find the user and check if they are a member of the tribe
    const userInTribe = tribe.members.includes(userId);
    if (!userInTribe) {
      return next(_boom2.default.badRequest("User is not a member of the tribe."));
    }

    // Add the user to the blocked list in the tribe
    tribe.blockedUsers.push(userId);

    // Remove the user from the members list of the tribe
    tribe.members = tribe.members.filter(member => member.toString() !== userId);

    // Save the updated tribe
    await tribe.save();

    // Add the tribe to the blocked user's blockedTribes list (in User model)
    const user = await _user2.default.findById(userId);
    if (!user) {
      return next(_boom2.default.notFound("User not found."));
    }

    // Add the tribe to the user's blockedTribes
    user.blockedbytribe.push(tribeId);
    await user.save();

    res.json({ message: "User successfully blocked from tribe." });
  } catch (error) {
    console.error("Error blocking user from tribe:", error);
    next(_boom2.default.internal("Error blocking user from tribe."));
  }
}; exports.blockUserFromTribe = blockUserFromTribe;

 const getUserDetails = async (req, res, next) => {
  try {
    const userId = req.user && req.user._id;  // Assumes user._id is set by your authentication middleware
    if (!userId) {
      return next(_boom2.default.unauthorized("User not authenticated."));
    }

    // Find the user by their ID and select specific fields (_id, username, profile_pic)
    const user = await _user2.default.findById(userId).select("_id username profile_pic");
    
    if (!user) {
      return next(_boom2.default.notFound("User not found."));
    }

    res.json(user);  // Send the user details as a response
  } catch (error) {
    console.error("Error fetching user details:", error);
    next(_boom2.default.internal("Error fetching user details."));
  }
}; exports.getUserDetails = getUserDetails;

var _tribechatlobbyjs = require('../../models/tribechatlobby.js'); var _tribechatlobbyjs2 = _interopRequireDefault(_tribechatlobbyjs);
var _TribeMessagejs = require('../../models/TribeMessage.js'); var _TribeMessagejs2 = _interopRequireDefault(_TribeMessagejs); // Assumes tribe messages use the same model


/**
 * Create or fetch tribe chat lobby by tribe ID
 */
 const createOrGetTribeChatLobby = async (req, res, next) => {
  try {
    const { tribeId } = req.params;

    if (!tribeId) {
      return res.status(400).json({ message: "Tribe ID is required." });
    }

    // Try to find existing chat lobby for tribe
    let lobby = await _tribechatlobbyjs2.default.findOne({ chatLobbyId: tribeId });

    if (!lobby) {
      // Create new chat lobby using tribeId as chatLobbyId
      lobby = new (0, _tribechatlobbyjs2.default)({ chatLobbyId: tribeId });
      await lobby.save();
    }

    // Fetch tribe data: title, thumbnail, messageSettings, and members (raw IDs)
    const tribe = await _mytribes2.default.findById(tribeId)
      .select("title thumbnail messageSettings members")
      .populate("members", "username"); // Populate members from User model with username

    if (!tribe) {
      return res.status(404).json({ message: "Tribe not found." });
    }

    // Map members to an array of objects with id and username
    const membersInfo = tribe.members.map((member) => ({
      _id: member._id,
      username: member.username,
    }));

    return res.status(200).json({
      chatLobbyId: lobby.chatLobbyId,
      lobby,
      tribe: {
        title: tribe.title,
        thumbnail: tribe.thumbnail,
        messageSettings: tribe.messageSettings,
        members: membersInfo,
      },
    });
  } catch (error) {
    next(error);
  }
}; exports.createOrGetTribeChatLobby = createOrGetTribeChatLobby;



/**
 * Get all messages for a tribe chat lobby with sender details.
 */
 const getTribeChatMessages = async (req, res, next) => {
  try {
    const { chatLobbyId } = req.params;
    const userId = req.query.userId || _optionalChain([req, 'access', _ => _.payload, 'optionalAccess', _2 => _2.user_id]);

    if (!chatLobbyId) {
      return res.status(400).json({ message: "Chat Lobby ID is required." });
    }

    const messages = await _TribeMessagejs2.default.find({
      chatLobbyId,
      deletedFor: { $ne: userId },
    }).populate("sender", "username profile_pic _id");

    if (!messages || messages.length === 0) {
      return res.status(404).json({ message: "No messages found for this tribe." });
    }

    res.json(messages);
  } catch (error) {
    next(error);
  }
}; exports.getTribeChatMessages = getTribeChatMessages;

exports. default = {
  joinTribe: exports.joinTribe,
  leaveTribe: exports.leaveTribe,
  getTribeMembers: exports.getTribeMembers,
  removeMemberFromTribe: exports.removeMemberFromTribe,
  createMytribe: exports.createMytribe,
  updateMytribe: exports.updateMytribe,
  deleteMytribe: exports.deleteMytribe,
  getMytribeById: exports.getMytribeById,
  getAllMytribes: exports.getAllMytribes,
  updateTribeStatus: exports.updateTribeStatus,
  getTotalMembers: exports.getTotalMembers,
  getUserDetails: exports.getUserDetails,
  getUserTribes: exports.getUserTribes,
  getUsersMytribes: exports.getUsersMytribes,
  getTribes: exports.getTribes,
  rateTribe: exports.rateTribe,
  getTribeById: exports.getTribeById,
  blockUserFromTribe: exports.blockUserFromTribe,
  getTribeForUser: exports.getTribeForUser,
  getTribeChatMessages: exports.getTribeChatMessages,
  createOrGetTribeChatLobby: exports.createOrGetTribeChatLobby,
  getSpecificMytribes: exports.getSpecificMytribes,
};
