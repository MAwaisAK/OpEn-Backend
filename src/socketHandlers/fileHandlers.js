import { users } from './usersInstance';
import mongoose from 'mongoose';
import Message from '../models/Message';
import TribeMessage from '../models/TribeMessage';
import multer from 'multer';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Initialize firebase admin (ensure your credentials are set properly)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const bucket = admin.storage().bucket();

// Set up Multer with memory storage and a file size limit of 20MB
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

// Helper function to upload a file buffer to Firebase Storage
export const uploadFileToFirebase = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }
    // Create a unique file name
    const fileName = `${Date.now()}-${file.originalname}`;
    const blob = bucket.file(fileName);
    console.log(blob);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4()
        }
      }
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      // Construct public URL
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

export { upload };

export const registerFileHandlers = (socket, io) => {
  // Group file message: save file message to DB and broadcast it.
  socket.on('newFileMessage', async (fileData, callback) => {
    // fileData should contain the Firebase file URL and mimetype.
    const user = users.getUser(socket.id);
    if (user && fileData && fileData.fileUrl) {
      try {
        console.log("Processing new file message...");
        // Validate sender's ObjectId
        if (!mongoose.Types.ObjectId.isValid(user.userId)) {
          console.error("Invalid ObjectId for sender:", user.userId);
          return callback && callback("Invalid user ID");
        }
        const senderId = new mongoose.Types.ObjectId(user.userId);

        // Determine file type based on mimetype, with fallback to URL extension if not provided.
        const imageRegex = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
        const videoRegex = /\.(mp4|mov|avi|mkv)(\?.*)?$/i;
        let isImage = false;
        let isVideo = false;
        if (fileData.mimetype) {
          isImage = fileData.mimetype.startsWith('image/');
          isVideo = fileData.mimetype.startsWith('video/');
        } else {
          isImage = imageRegex.test(fileData.fileUrl);
          isVideo = videoRegex.test(fileData.fileUrl);
        }

        // Create a new Message document with file details
        const msgDoc = new Message({
          chatLobbyId: user.room,    // Chat lobby id
          sender: senderId,          // Sender's ObjectId
          message: "",               // No text message in this case
          fileUrl: fileData.fileUrl, // Firebase file URL
          isImage: isImage,          // Set based on mimetype (or URL extension)
          isVideo: isVideo,          // Set based on mimetype (or URL extension)
          type: "file",              // Specify message type as 'file'
          sentAt: new Date()         // Use 'sentAt' to match your model
        });
        await msgDoc.save();

        // Prepare payload for broadcast including both flags
        const payload = {
          from: user.name,
          url: fileData.fileUrl,
          sentAt: msgDoc.sentAt,
          isImage: isImage,
          isVideo: isVideo
        };
        io.to(user.room).emit('newFileMessage', payload);
        if (callback) callback();
      } catch (err) {
        console.error("Error saving file message to DB:", err);
        if (callback) callback("Error saving file message");
      }
    }
  });
  socket.on('tribeNewFileMessage', async (fileData, callback) => {
    // fileData should contain the Firebase file URL and mimetype.
    const user = users.getUser(socket.id);
    if (user && fileData && fileData.fileUrl) {
      try {
        console.log("Processing new file message...");
        // Validate sender's ObjectId
        if (!mongoose.Types.ObjectId.isValid(user.userId)) {
          console.error("Invalid ObjectId for sender:", user.userId);
          return callback && callback("Invalid user ID");
        }
        const senderId = new mongoose.Types.ObjectId(user.userId);

        // Determine file type based on mimetype, with fallback to URL extension if not provided.
        const imageRegex = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
        const videoRegex = /\.(mp4|mov|avi|mkv)(\?.*)?$/i;
        let isImage = false;
        let isVideo = false;
        if (fileData.mimetype) {
          isImage = fileData.mimetype.startsWith('image/');
          isVideo = fileData.mimetype.startsWith('video/');
        } else {
          isImage = imageRegex.test(fileData.fileUrl);
          isVideo = videoRegex.test(fileData.fileUrl);
        }

        // Create a new Message document with file details
        const msgDoc = new TribeMessage({
          chatLobbyId: user.room,    // Chat lobby id
          sender: senderId,          // Sender's ObjectId
          message: "",               // No text message in this case
          fileUrl: fileData.fileUrl, // Firebase file URL
          isImage: isImage,          // Set based on mimetype (or URL extension)
          isVideo: isVideo,          // Set based on mimetype (or URL extension)
          type: "file",              // Specify message type as 'file'
          sentAt: new Date()         // Use 'sentAt' to match your model
        });
        await msgDoc.save();

        // Prepare payload for broadcast including both flags
        const payload = {
          from: user.name,
          url: fileData.fileUrl,
          sentAt: msgDoc.sentAt,
          isImage: isImage,
          isVideo: isVideo
        };
        io.to(user.room).emit('newTribeMessage', payload);
        if (callback) callback();
      } catch (err) {
        console.error("Error saving file message to DB:", err);
        if (callback) callback("Error saving file message");
      }
    }
  });
  // In your socket handler file (or wherever you handle socket events):
socket.on('deleteMessage', async (data, callback) => {
  // data should contain: { messageId, deleteType }
  try {
    const msg = await Message.findById(data.messageId);
    if (!msg) {
      return callback("Message not found");
    }

    // If the message is a file and deletion is for everyone, delete the file from Firebase
    if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
      try {
        // The public URL is in the format:
        // https://firebasestorage.googleapis.com/v0/b/<bucketName>/o/<fileName>?alt=media
        const urlObj = new URL(msg.fileUrl);
        const pathname = urlObj.pathname; // e.g., /v0/b/your-bucket/o/encodedFileName
        const encodedFileName = pathname.split('/o/')[1];
        const fileName = decodeURIComponent(encodedFileName.split('?')[0]);
        await bucket.file(fileName).delete();
        console.log(`Deleted file ${fileName} from Firebase`);
      } catch (fileDelErr) {
        console.error("Error deleting file from Firebase:", fileDelErr);
      }
    }

    // Delete the message document from the database
    await Message.findByIdAndDelete(data.messageId);

    // Notify clients that the message was deleted (you can adjust this as needed)
    io.to(msg.chatLobbyId).emit('messageDeleted', { messageId: data.messageId });
    callback(null, "Message deleted");
  } catch (err) {
    console.error("Error deleting message:", err);
    callback("Error deleting message");
  }
});

socket.on('deleteTribeMessage', async (data, callback) => {
  // data should contain: { messageId, deleteType }
  try {
    const msg = await TribeMessage.findById(data.messageId);
    if (!msg) {
      return callback("Message not found");
    }

    // If the message is a file and deletion is for everyone, delete the file from Firebase
    if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
      try {
        // Parse and delete the Firebase file
        const urlObj = new URL(msg.fileUrl);
        const pathname = urlObj.pathname;
        const encodedFileName = pathname.split('/o/')[1];
        const fileName = decodeURIComponent(encodedFileName.split('?')[0]);
        await bucket.file(fileName).delete();
        console.log(`Deleted file ${fileName} from Firebase`);
      } catch (fileDelErr) {
        console.error("Error deleting file from Firebase:", fileDelErr);
      }
    }

    // Delete the message document from the database
    await TribeMessage.findByIdAndDelete(data.messageId);

    // Notify clients in the tribe room
    io.to(msg.chatLobbyId).emit('tribeMessageDeleted', { messageId: data.messageId });
    callback(null, "Tribe message deleted");
  } catch (err) {
    console.error("Error deleting tribe message:", err);
    callback("Error deleting message");
  }
});
};