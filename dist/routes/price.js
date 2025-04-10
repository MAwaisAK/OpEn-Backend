"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _jwt = require('../helpers/jwt');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);





var _price = require('../controllers/price');

const router = _express2.default.Router();

// Endpoint to get pricing details for small, large, and custom tiers.
router.get(
  "/small-large-custom",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "readAny", "price"),
  async (req, res, next) => {
    try {
      const pricing = await _price.getSmallLargeCustomPricing.call(void 0, );
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }
);

// Endpoint to get pricing details for basic and premium tiers.
router.get(
  "/basic-premium",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "readAny", "price"),
  async (req, res, next) => {
    try {
      const pricing = await _price.getBasicPremiumPricing.call(void 0, );
      res.json(pricing);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "readAny", "price"),
  async (req, res, next) => {
    try {
      const pricing = await _price.getAllPricing.call(void 0, );
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
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "price"),
  async (req, res, next) => {
    try {
      const updatedPricing = await _price.updatePricing.call(void 0, req.body);
      res.json(updatedPricing);
    } catch (error) {
      next(error);
    }
  }
);

exports. default = router;
