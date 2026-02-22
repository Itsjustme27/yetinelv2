require('dotenv').config();

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/init');
const { getDatabase } = require('../database/init');
// LOGIN ROUTE
router.post('/login', async (req,res) => {
  console.log("Login attempt received!");
  console.log("Type of res.status:", typeof res.status);
  const { username, password } = req.body;

  try {
    const user = getDatabase().prepare('SELECT * FROM users WHERE username = ?').get(username);

    if(!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if(!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id:user.id, username: user.username, role: user.role }
    });

  } catch(err) {
      res.status(500).json({ message: 'Server error' });
      console.error("Auth Error:", err); 
  }
  
});

module.exports = router;
