"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// jobs/subscriptionCron.js
var _nodecron = require('node-cron'); var _nodecron2 = _interopRequireDefault(_nodecron);
var _momenttimezone = require('moment-timezone'); var _momenttimezone2 = _interopRequireDefault(_momenttimezone);
var _userjs = require('../models/user.js'); var _userjs2 = _interopRequireDefault(_userjs); // Adjust path if needed

// Runs every day at midnight Canadian Central Time
_nodecron2.default.schedule('0 0 * * *', async () => {
  const now = _momenttimezone2.default.call(void 0, ).tz('America/Toronto'); // Canada Eastern Time Zone
  console.log(`Running subscription check at ${now.format()}`);

  try {
    const users = await _userjs2.default.find({
      subscription: { $ne: 'none' } // only those with a trial or real sub
    });

    for (const user of users) {
      if (!user.subscribed_At) continue;

      const subscribedDate = _momenttimezone2.default.call(void 0, user.subscribed_At);
      const diffDays = now.diff(subscribedDate, 'days');

      let shouldDeactivate = false;

      if (user.subscription === 'trial') {
        shouldDeactivate = diffDays >= 7;
      } else if (user.period === 'month') {
        shouldDeactivate = diffDays >= 30;
      } else if (user.period === 'year') {
        shouldDeactivate = diffDays >= 365;
      }

      if (shouldDeactivate) {
        user.subscription = 'none';
        user.trial_used = true;
        await user.save();
        console.log(`Subscription expired for user: ${user.email}`);
      }
    }
  } catch (err) {
    console.error('Error running subscription cron:', err);
  }
});
