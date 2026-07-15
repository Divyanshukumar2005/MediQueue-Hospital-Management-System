const router = require('express').Router();
const { register, login, googleAuth, getMe, forgotPassword } = require('../controllers/authController');
router.post('/register',       register);
router.post('/login',          login);
router.post('/google-auth',    googleAuth);
router.get('/me',              getMe);
router.post('/forgot-password', forgotPassword);
module.exports = router;
