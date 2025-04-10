// models/lift-ai.js
import mongoose from "mongoose";
const { Schema } = mongoose;

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

const LiftAi = mongoose.model("LiftAi", LiftAiSchema);
export default LiftAi;
