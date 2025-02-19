require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // For generating OTPs

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
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Password validation function
function isValidPassword(password) {
  const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
  return passwordPattern.test(password);
}

// In-memory OTP store (for simplicity)
const otpStore = {};

// Generate OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Routes
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/signup', (req, res) => res.sendFile(__dirname + '/signup.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));
app.get('/invoice', (req, res) => res.sendFile(__dirname + '/invoice.html'));
app.get('/home', (req, res) => res.sendFile(__dirname + '/home.html'));
app.get('/services', (req, res) => res.sendFile(__dirname + '/services.html'));
app.get('/contact', (req, res) => res.sendFile(__dirname + '/contact.html'));
app.get('/newcontact', (req, res) => res.sendFile(__dirname + '/newcontact.html'));

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { email, fullname } = req.body;

  try {
    // Generate and store OTP
    const otp = generateOTP();
    otpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 }; // OTP valid for 10 minutes

    // Send OTP via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for Registration',
      text: `Hi ${fullname},\n\nYour OTP for registration is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nBest regards,\nYour Team`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
      }
      console.log('OTP sent:', info.response);
      res.json({ success: true, message: 'OTP sent successfully.' });
    });
  } catch (err) {
    console.error('Error generating OTP:', err);
    res.status(500).json({ error: 'An error occurred while generating OTP.' });
  }
});

// Verify OTP and Register User
app.post('/verify-otp', async (req, res) => {
  const { fullname, email, username, password, otp } = req.body;

  // Check if OTP is valid
  if (!otpStore[email] || otpStore[email].otp !== otp) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }

  // Check if OTP is expired
  if (Date.now() > otpStore[email].expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  // Validate password
  if (!isValidPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
    });
  }

  try {
    // Hash password and save user in database
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await pool.query(
      'INSERT INTO users (fullname, email, username, password) VALUES ($1, $2, $3, $4)',
      [fullname, email, username, hashedPassword]
    );

    // Remove OTP after successful registration
    delete otpStore[email];

    // Send "Registration Successful" email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Registration Successful',
      text: `Hi ${fullname},\n\nThank you for registering. Your account has been created successfully.\n\nYou can now log in to your account using your credentials.\n\nBest regards,\nYour Team`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending registration success email:', error);
        return res.status(500).json({ error: 'Account created, but confirmation email could not be sent.' });
      }
      console.log('Registration success email sent:', info.response);
      res.json({ success: true, message: 'Account created successfully and confirmation email sent.' });
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'An error occurred while registering the user.' });
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

// New Route: Add Invoice with Items
app.post('/add-invoice', async (req, res) => {
  const { invoiceDate, invoiceNumber, customerName, customerAddress, customerEmail, taxPercentage, items } = req.body;

  try {
    // Insert main invoice entry into the invoices table
    await pool.query(
      'INSERT INTO invoices (invoice_date, invoice_number, customer_name, customer_address, customer_email, tax_percentage) VALUES ($1, $2, $3, $4, $5, $6)',
      [invoiceDate, invoiceNumber, customerName, customerAddress, customerEmail, taxPercentage]
    );

    // Insert items into invoice_items table
    for (const item of items) {
      const total = item.quantity * item.unitPrice; // Calculate total for each item
      await pool.query(
        'INSERT INTO invoice_items (description, quantity, unit_price, total) VALUES ($1, $2, $3, $4)',
        [item.description, item.quantity, item.unitPrice, total]
      );
    }

    res.status(200).json({ success: true, message: 'Invoice and items added successfully.' });
  } catch (err) {
    console.error('Error adding invoice and items:', err);  // Log error details
    res.status(500).json({ success: false, error: 'Failed to add invoice and items. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
