const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./config');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header is missing' });
    }

    const token = authHeader.split(' ')[1]; // Assuming "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ message: 'Token is missing' });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token is invalid or expired' });
        }

        next();
    });
};

module.exports = { authMiddleware };
