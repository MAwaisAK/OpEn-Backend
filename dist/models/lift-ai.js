"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// models/lift-ai.js
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
const { Schema } = _mongoose2.default;

const QuestionSchema = new Schema(
  {
    type: { type: String, required: true },
    prompt: { type: String, required: true },
    key: { type: String }, // optional, for questions needing an answer key
    options: { type: [String], default: [] } // used only for Dropdown type
  },
  { _id: false } // no separate _id for each question object
);

const LiftAiSchema = new Schema(
  {
    questions: {
      type: [QuestionSchema],
      default: []
    }
  },
  { timestamps: true }
);

const LiftAi = _mongoose2.default.model("LiftAi", LiftAiSchema);
exports. default = LiftAi;
