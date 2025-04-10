"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _liftaijs = require('../../models/lift-ai.js'); var _liftaijs2 = _interopRequireDefault(_liftaijs);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);
var _openai = require('openai'); var _openai2 = _interopRequireDefault(_openai);
var _userjs = require('../../models/user.js'); var _userjs2 = _interopRequireDefault(_userjs);
var _userpromptsjs = require('../../models/userprompts.js'); var _userpromptsjs2 = _interopRequireDefault(_userpromptsjs);

// Initialize OpenAI (ensure your .env file includes OPENAI_API_KEY)
const openai = new (0, _openai2.default)({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat function – sends the user’s message to OpenAI, returns the AI response,
// appends the conversation pair to an active session in the Prompts model,
// and deducts tokens from the user's account using a 50% discount rate.
const chat = async (req, res, next) => {
  try {
    const { message, userId } = req.body;
    console.log("Received message:", message);

    // Get AI response
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: message }],
    });

    const reply = response.choices[0].message.content;

    // Calculate tokens used
    const tokensUsed = response.usage && response.usage.total_tokens
      ? response.usage.total_tokens
      : Math.ceil((message.length + reply.length) / 4);

    // Find or create a prompt session
    let promptDoc = await _userpromptsjs2.default.findOne({ user: userId, sessionActive: true });

    if (!promptDoc) {
      promptDoc = new (0, _userpromptsjs2.default)({
        user: userId,
        entered_prompt: [],
        tokens_used: 0,
        sessionActive: true,
      });
    }

    // Append conversation and update total tokens
    promptDoc.entered_prompt.push([`user ${message}`, `bot ${reply}`]);
    promptDoc.tokens_used += tokensUsed;

    await promptDoc.save();

    // Deduct cost from user tokens (50% discount)
    const cost = Math.ceil(tokensUsed * 0.5);
    const userDoc = await _userjs2.default.findById(userId);

    if (userDoc) {
      userDoc.tokens = Math.max(0, (userDoc.tokens || 0) - cost);
      await userDoc.save();
    }

    return res.json({ reply, tokensUsed, totalTokensUsed: promptDoc.tokens_used });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: "Error processing your request" });
  }
};


// Get LiftAi prompt data. Always fetches from the database.
const getPrompt = async (req, res, next) => {
  try {
    const liftAiDoc = await _liftaijs2.default.findOne();
    if (!liftAiDoc) {
      return next(_boom2.default.notFound("Prompt data not found"));
    }
    return res.status(200).json({ success: true, data: liftAiDoc });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching LiftAi prompt data", error));
  }
};

// Update LiftAi prompt data. Expects a payload with a "questions" array.
const updatePrompt = async (req, res, next) => {
  try {
    const { questions } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return next(_boom2.default.badRequest("Questions is required and must be an array."));
    }
    let liftAiDoc = await _liftaijs2.default.findOne();
    if (!liftAiDoc) {
      liftAiDoc = new (0, _liftaijs2.default)({ questions });
    } else {
      liftAiDoc.questions = questions;
    }
    await liftAiDoc.save();
    return res.status(200).json({ success: true, data: liftAiDoc });
  } catch (error) {
    return next(_boom2.default.internal("Error updating LiftAi prompt data", error));
  }
};

// Get user tokens for a given user by ID.
const getUserTokens = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await _userjs2.default.findById(userId);
    if (!user) {
      return next(_boom2.default.notFound("User not found"));
    }
    return res.status(200).json({ success: true, tokens: user.tokens || 0 });
  } catch (error) {
    console.error("Error fetching user tokens:", error);
    return next(_boom2.default.internal("Error retrieving user tokens", error));
  }
};

// Get all conversation prompts for a given user.
const getAllPrompts = async (req, res, next) => {
  try {
    const prompts = await _userpromptsjs2.default.find()
      .populate("user", "username _id") // Populate user field with username and ID
      .lean(); // Convert to plain objects for easier manipulation

    return res.status(200).json({ success: true, data: prompts });
  } catch (error) {
    console.error("Error fetching all prompts:", error);
    return next(_boom2.default.internal("Error retrieving all prompts", error));
  }
};



exports. default = { chat, getPrompt, updatePrompt, getUserTokens, getAllPrompts };
