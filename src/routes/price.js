import express from "express";
import { verifyAccessToken } from "../helpers/jwt";
import grantAccess from "../middlewares/grantAccess";
import { 
  getSmallLargeCustomPricing, 
  getBasicPremiumPricing, 
  updatePricing,
  getAllPricing 
} from "../controllers/price";

const router = express.Router();

// Endpoint to get pricing details for small, large, and custom tiers.
router.get(
  "/small-large-custom",
  verifyAccessToken,
  grantAccess("readAny", "price"),
  async (req, res, next) => {
    try {
      const pricing = await getSmallLargeCustomPricing();
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }
);

// Endpoint to get pricing details for basic and premium tiers.
router.get(
  "/basic-premium",
  verifyAccessToken,
  grantAccess("readAny", "price"),
  async (req, res, next) => {
    try {
      const pricing = await getBasicPremiumPricing();
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  verifyAccessToken,
  grantAccess("readAny", "price"),
  async (req, res, next) => {
    try {
      const pricing = await getAllPricing();
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }
);
// Endpoint to update all pricing fields at once.
// Expects a payload that matches the Price schema structure.
router.put(
  "/",
  verifyAccessToken,
  grantAccess("updateAny", "price"),
  async (req, res, next) => {
    try {
      const updatedPricing = await updatePricing(req.body);
      res.json(updatedPricing);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
