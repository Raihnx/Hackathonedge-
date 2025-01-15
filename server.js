require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); // Import nodemailer

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Nodemailer Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use Gmail or your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // App password or email password
  },
});

// Password validation function
function isValidPassword(password) {
  const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
  return passwordPattern.test(password);
}

// Routes
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/signup', (req, res) => res.sendFile(__dirname + '/signup.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));

// Handle Signup
app.post('/signup', async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (!isValidPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await pool.query(
      'INSERT INTO users (fullname, email, username, password) VALUES ($1, $2, $3, $4)',
      [fullname, email, username, hashedPassword]
    );

    // Send a confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Registration Successful',
      text: `Hi ${fullname},\n\nThank you for registering. Your account has been created successfully.\n\nBest regards,\nYour Team`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'User registered, but email could not be sent.' });
      }
      console.log('Email sent:', info.response);
      res.redirect('/login');
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registering user.' });
  }
});

// Handle Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email does not exist.' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      console.log('Login successful for:', email);
      return res.json({ success: true });
    } else {
      console.log('Invalid password for:', email);
      return res.status(401).json({ error: 'Incorrect password.' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'An error occurred while logging in. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
