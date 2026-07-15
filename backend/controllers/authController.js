// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, OPDCard } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env — refusing to start with an insecure default.');
}
const JWT_EXPIRE = '7d';

function makeToken(user) {
    return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

function safeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        photo_url: user.photo_url,
        role: user.role,
        auth_provider: user.auth_provider
    };
}

// POST /api/register
const register = async(req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

        const existing = await User.findOne({ where: { email } });
        if (existing)
            return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashed,
            phone: phone || null,
            role: 'patient',
            auth_provider: 'local',
            photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`,
        });

        const token = makeToken(user);
        return res.status(201).json({ success: true, message: 'Account created successfully.', token, user: safeUser(user) });
    } catch (e) {
        console.error('Register error:', e);
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
};

// POST /api/login
const login = async(req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password are required.' });

        const user = await User.findOne({ where: { email } });
        if (!user)
            return res.status(401).json({ success: false, message: 'No account found with this email.' });

        if (user.auth_provider === 'google')
            return res.status(400).json({ success: false, message: 'This account uses Google Sign-In. Please login with Google.' });

        if (!user.is_active)
            return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact admin.' });

        const match = await bcrypt.compare(password, user.password || '');
        if (!match)
            return res.status(401).json({ success: false, message: 'Incorrect password.' });

        const opdCard = await OPDCard.findOne({ where: { user_id: user.id } });
        const token = makeToken(user);

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: safeUser(user),
            hasOpdCard: !!opdCard,
            opdCardId: opdCard ? opdCard.id : null,
        });
    } catch (e) {
        console.error('Login error:', e);
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
};

// POST /api/google-auth
const googleAuth = async(req, res) => {
    try {
        const { name, email, photo_url } = req.body;
        if (!name || !email)
            return res.status(400).json({ success: false, message: 'Name and email are required.' });

        let user = await User.findOne({ where: { email } });

        const created = !user;
        if (!user) {
            // Naya user banao
            user = await User.create({
                name,
                email,
                photo_url: photo_url || null,
                role: 'patient',
                auth_provider: 'google',
                password: null,
            });
        } else {
            // Existing user — chahe local ho ya google — update karo aur login karo
            await user.update({
                name,
                photo_url: photo_url || user.photo_url,
                auth_provider: 'google', // Google se login kiya toh google mark karo
            });
        }

        if (!user.is_active)
            return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });

        const opdCard = await OPDCard.findOne({ where: { user_id: user.id } });
        const token = makeToken(user);

        return res.status(200).json({
            success: true,
            message: created ? 'Account created via Google.' : 'Login successful.',
            token,
            user: safeUser(user),
            hasOpdCard: !!opdCard,
            opdCardId: opdCard ? opdCard.id : null,
        });
    } catch (e) {
        console.error('Google auth error:', e);
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
};

// GET /api/me
const getMe = async(req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided.' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        const opdCard = await OPDCard.findOne({ where: { user_id: user.id } });
        return res.status(200).json({
            success: true,
            user: safeUser(user),
            hasOpdCard: !!opdCard,
            opdCardId: opdCard ? opdCard.id : null
        });
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
    }
};

// POST /api/forgot-password
const forgotPassword = async(req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ success: false, message: 'No account found with this email address.' });
        if (user.auth_provider === 'google')
            return res.status(400).json({ success: false, message: 'This account uses Google Sign-In. Please use Google to log in.' });
        return res.status(200).json({ success: true, message: 'Email verified. Proceed to send reset link.' });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

module.exports = { register, login, googleAuth, getMe, forgotPassword };