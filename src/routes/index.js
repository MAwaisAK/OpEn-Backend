import { Router } from 'express';
// helpers
import { verifyAccessToken } from '../helpers/jwt';

// routes
import auth from './auth';
import chat from './uploads';
import messageRoutes from './message'; // our new routes file for deletion
import courseRoutes from './course'; // our new routes file for deletion
import toolRoutes from './tools'; // our new routes file for deletion
import liftAiRoutes from './lift-ai'; // our new routes file for deletion
import mytribes from './mytribes'; // our new routes file for deletion
import price from './price'; // our new routes file for deletion
import stats from './stats'; // our new routes file for deletion
//import product from './product';
//import order from './order';
import categories from './categories';
//import reports from './reports';
import verify from './verification';
import images from './images';
import testimonals from './testimonals';
import support from './support';
import notification from './notifications';
import payment from './payment';
const router = Router();

router.get('/', (req, res) => {
  res.end('hey');
});
router.use('/auth', auth);
router.use('/verify',verify);
router.use('/',chat);
router.use('/messages', messageRoutes);
router.use('/course', courseRoutes);
router.use('/tool', toolRoutes);
router.use("/my-tribes", mytribes); // New endpoint: /lift-ai
router.use("/lift-ai", liftAiRoutes); // New endpoint: /lift-ai
router.use("/price", price); // New endpoint: /lift-ai
router.use("/testimonals", testimonals); 
router.use("/support", support); // New endpoint: /lift-ai
router.use("/notifications", notification); // New endpoint: /lift-ai
router.use("/payment", payment); // New endpoint: /lift-ai
router.use("/stats", stats); // New endpoint: /lift-ai
//router.use('/product', product);
//router.use('/mycron', Cron);
//router.use('/order', verifyAccessToken, order);
router.use('/categories', categories);
//router.use('/reports', reports);
router.use('/images', images );


export default router;
