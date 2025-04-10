// jobs/subscriptionCron.js
import cron from 'node-cron';
import moment from 'moment-timezone';
import User from '../models/user.js'; // Adjust path if needed

// Runs every day at midnight Canadian Central Time
cron.schedule('0 0 * * *', async () => {
  const now = moment().tz('America/Toronto'); // Canada Eastern Time Zone
  console.log(`Running subscription check at ${now.format()}`);

  try {
    const users = await User.find({
      subscription: { $ne: 'none' } // only those with a trial or real sub
    });

    for (const user of users) {
      if (!user.subscribed_At) continue;

      const subscribedDate = moment(user.subscribed_At);
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
