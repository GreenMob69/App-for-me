'use strict';

const API_TOKEN = process.env.API_TOKEN || 'telemetrie-dev-2024';

const requireAuth = (req, res, next) => {
    const auth = req.headers['authorization'];
    if (auth === `Bearer ${API_TOKEN}`) return next();
    res.status(401).json({ eroare: 'Token invalid sau lipsă.' });
};

module.exports = { requireAuth };
