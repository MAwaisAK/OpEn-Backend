"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// src/socketHandlers/chatHandlers.jsx
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
var _validation = require('../utils/validation');
var _Message = require('../models/Message'); var _Message2 = _interopRequireDefault(_Message);
var _TribeMessage = require('../models/TribeMessage'); var _TribeMessage2 = _interopRequireDefault(_TribeMessage);
var _notifications = require('../models/notifications'); var _notifications2 = _interopRequireDefault(_notifications);
var _user = require('../models/user'); var _user2 = _interopRequireDefault(_user);
var _chatlobby = require('../models/chatlobby'); var _chatlobby2 = _interopRequireDefault(_chatlobby);
var _tribechatlobby = require('../models/tribechatlobby'); var _tribechatlobby2 = _interopRequireDefault(_tribechatlobby);
var _usersInstance = require('./usersInstance');

 const registerChatHandlers = (socket, io) => {
  // Handle room join event
  socket.on('join', (params, callback) => {
    if (!_validation.isRealString.call(void 0, params.name) || !_validation.isRealString.call(void 0, params.room) || !_validation.isRealString.call(void 0, params.userId)) {
      return callback('Name, room, and userId are required.');
    }
    socket.join(params.room);
    _usersInstance.users.removeUser(socket.id);
    _usersInstance.users.addUser(socket.id, params.name, params.room, params.userId);
    io.to(params.room).emit('updateUserList', _usersInstance.users.getUserList(params.room));
    callback();
  });

  socket.on('createMessage', async (message, callback) => {
    const user = _usersInstance.users.getUser(socket.id);
    if (user && _validation.isRealString.call(void 0, message.text)) {
      try {
        if (!_mongoose2.default.Types.ObjectId.isValid(user.userId)) {
          console.error("Invalid ObjectId for sender:", user.userId);
          return callback("Invalid user ID");
        }
        const senderId = new _mongoose2.default.Types.ObjectId(user.userId);
        // Create a new text message document
        const msgDoc = new (0, _Message2.default)({
          chatLobbyId: user.room,  // user.room corresponds to chatLobbyId in ChatLobby
          sender: senderId,
          message: message.text,
          type: "text",    // Mark as a text message
          seen: false      // Initially, the message is not seen
        });
        console.log("Attempting save message:", msgDoc);
        await msgDoc.save();
        console.log("Message:", msgDoc._id);
        console.log("Room:", user.room);
        
        // Update the ChatLobby: clear the deletefor array (set it to an empty array)
        await _chatlobby2.default.findOneAndUpdate(
          { chatLobbyId: user.room },
          { $set: { deletefor: [] } }
        );
        console.log(`Cleared deletefor for ChatLobby ${user.room}`);
        
        // --- Notification Logic ---
        // Fetch the ChatLobby document to get all participants
        const chatLobbyDoc = await _chatlobby2.default.findOne({ chatLobbyId: user.room });
        if (chatLobbyDoc && chatLobbyDoc.participants && chatLobbyDoc.participants.length > 0) {
          // Loop through each participant
          for (const participant of chatLobbyDoc.participants) {
            // Compare participant id (as string) with sender's id
            if (participant.toString() !== user.userId) {
              // Look up the other user's details
              const otherUser = await _user2.default.findById(participant);
              if (otherUser) {
                const notificationText = `New Message from ${otherUser.username}`;
                await _notifications2.default.updateOne(
                  { user: participant },
                  { $addToSet: { type: "message", data: notificationText } },
                  { upsert: true }
                );
              }
            }
          }
        }
        // --- End Notification Logic ---
  
        // Prepare payload with _id and other fields
        const payload = {
          _id: msgDoc._id,          // Include the MongoDB _id
          text: msgDoc.message,
          from: user.name,
          sentAt: msgDoc.sentAt,
          seen: false,
          type: "text"
        };
        // Emit the full message payload to all clients in the room
        io.to(user.room).emit('newMessage', payload);
      } catch (err) {
        console.error("Error saving message to DB:", err);
        return callback("Error saving message");
      }
    } else {
      console.error("Invalid user or empty message");
    }
    callback();
  });
  
  socket.on('tribeCreateMessage', async (message, callback) => {
    const user = _usersInstance.users.getUser(socket.id);
    if (user && _validation.isRealString.call(void 0, message.text)) {
      try {
        if (!_mongoose2.default.Types.ObjectId.isValid(user.userId)) {
          console.error("Invalid ObjectId for sender:", user.userId);
          return callback("Invalid user ID");
        }
        const senderId = new _mongoose2.default.Types.ObjectId(user.userId);
        // Create a new text message document
        const msgDoc = new (0, _TribeMessage2.default)({
          chatLobbyId: user.room,  // user.room corresponds to chatLobbyId in ChatLobby
          sender: senderId,
          message: message.text,
          type: "text",    // Mark as a text message
          seen: false      // Initially, the message is not seen
        });
        console.log("Attempting save message:", msgDoc);
        await msgDoc.save();
        console.log("Message:", msgDoc._id);
        console.log("Room:", user.room);
        
        // Update the ChatLobby: clear the deletefor array (set it to an empty array)
        await _tribechatlobby2.default.findOneAndUpdate(
          { chatLobbyId: user.room },
          { $set: { deletefor: [] } }
        );
        console.log(`Cleared deletefor for ChatLobby ${user.room}`);
        
        // --- Notification Logic ---
        // Fetch the ChatLobby document to get all participants
        const chatLobbyDoc = await _tribechatlobby2.default.findOne({ chatLobbyId: user.room });
        if (chatLobbyDoc && chatLobbyDoc.participants && chatLobbyDoc.participants.length > 0) {
          // Loop through each participant
          for (const participant of chatLobbyDoc.participants) {
            // Compare participant id (as string) with sender's id
            if (participant.toString() !== user.userId) {
              // Look up the other user's details
              const otherUser = await _user2.default.findById(participant);
              if (otherUser) {
                const notificationText = `New Message from ${otherUser.username}`;
                await _notifications2.default.updateOne(
                  { user: participant },
                  { $addToSet: { type: "message", data: notificationText } },
                  { upsert: true }
                );
              }
            }
          }
        }
        // --- End Notification Logic ---
  
        // Prepare payload with _id and other fields
        const payload = {
          _id: msgDoc._id,          // Include the MongoDB _id
          text: msgDoc.message,
          from: user.name,
          sentAt: msgDoc.sentAt,
          seen: false,
          type: "text"
        };
        // Emit the full message payload to all clients in the room
        io.to(user.room).emit('newTribeMessage', payload);
      } catch (err) {
        console.error("Error saving message to DB:", err);
        return callback("Error saving message");
      }
    } else {
      console.error("Invalid user or empty message");
    }
    callback();
  });

  socket.on("messageSeen", async ({ messageId, room }) => {
    try {
      const updatedMessage = await _Message2.default.findByIdAndUpdate(
        messageId,
        { seen: true },
        { new: true }
      );
  
      if (updatedMessage) {
        io.to(room).emit("messageUpdated", updatedMessage);
      }
    } catch (error) {
      console.error("Error updating message seen status:", error);
    }
  });
  

  // New deleteMessage event handler
  socket.on('deleteMessage', async (data, callback) => {
    try {
      const msg = await _Message2.default.findById(data.messageId);
      if (!msg) return callback("Message not found");
  
      // Enforce 7-minute deletion window
      if (data.deleteType === "forEveryone") {
        const messageAge = moment().diff(moment(msg.sentAt), "minutes");
        if (messageAge >= 7) {
          return callback("Deletion time window expired");
        }
      }
  
      // If it's a file message, delete from Firebase
      if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
        try {
          const urlObj = new URL(msg.fileUrl);
          const encodedFileName = urlObj.pathname.split('/o/')[1];
          const fileName = decodeURIComponent(encodedFileName.split('?')[0]);
          await bucket.file(fileName).delete();
          console.log(`Deleted file ${fileName} from Firebase`);
        } catch (fileDelErr) {
          console.error("Error deleting file from Firebase:", fileDelErr);
        }
      }
  
      // Delete the message from DB
      await _Message2.default.findByIdAndDelete(data.messageId);
  
      // Emit message deletion to all clients in the chat room
      io.to(msg.chatLobbyId).emit('messageDeleted', { messageId: data.messageId });
  
      callback(null, "Message deleted");
    } catch (err) {
      console.error("Error deleting message:", err);
      callback("Error deleting message");
    }
  });
  
  socket.on('deleteTribeMessage', async (data, callback) => {
    try {
      const msg = await _TribeMessage2.default.findById(data.messageId);
      if (!msg) return callback("Message not found");
  
      // Enforce 7-minute deletion window
      if (data.deleteType === "forEveryone") {
        const messageAge = moment().diff(moment(msg.sentAt), "minutes");
        if (messageAge >= 7) {
          return callback("Deletion time window expired");
        }
      }
  
      // If it's a file message, delete from Firebase
      if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
        try {
          const urlObj = new URL(msg.fileUrl);
          const encodedFileName = urlObj.pathname.split('/o/')[1];
          const fileName = decodeURIComponent(encodedFileName.split('?')[0]);
          await bucket.file(fileName).delete();
          console.log(`Deleted file ${fileName} from Firebase`);
        } catch (fileDelErr) {
          console.error("Error deleting file from Firebase:", fileDelErr);
        }
      }
  
      // Delete the message from DB
      await _TribeMessage2.default.findByIdAndDelete(data.messageId);
  
      // Emit message deletion to all clients in the chat room
      io.to(msg.chatLobbyId).emit('messageDeleted', { messageId: data.messageId });
  
      callback(null, "Message deleted");
    } catch (err) {
      console.error("Error deleting message:", err);
      callback("Error deleting message");
    }
  });

}; exports.registerChatHandlers = registerChatHandlers;
