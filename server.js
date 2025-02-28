require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');

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

// Generate OTP function
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// In-memory OTP store (for simplicity)
const otpStore = {};

// Routes
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/signup', (req, res) => res.sendFile(__dirname + '/signup.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));
app.get('/home', (req, res) => res.sendFile(__dirname + '/home.html'));
app.get('/services', (req, res) => res.sendFile(__dirname + '/services.html'));
app.get('/contact', (req, res) => res.sendFile(__dirname + '/contact.html'));
app.get('/invoice', (req, res) => res.sendFile(path.join(__dirname, 'invoice.html')));

// 🏥 **Book an Appointment**
app.post('/book-appointment', async (req, res) => {
  const { patientName, patientAge, patientGender, patientEmail, doctor, symptoms, appointmentDate, appointmentTime } = req.body;

  try {
    await pool.query(
      'INSERT INTO appointments (patient_name, patient_age, patient_gender, patient_email, doctor, symptoms, appointment_date, appointment_time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [patientName, patientAge, patientGender, patientEmail, doctor, symptoms, appointmentDate, appointmentTime]
    );

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: patientEmail,
      subject: 'Appointment Confirmation - MediCare',
      html: `
        <h3>Dear ${patientName},</h3>
        <p>Your appointment has been successfully booked.</p>
        <p><strong>Date:</strong> ${appointmentDate}</p>
        <p><strong>Time:</strong> ${appointmentTime}</p>
        <p><strong>Doctor:</strong> ${doctor}</p>
        <p><strong>Symptoms:</strong> ${symptoms}</p>
        <br>
        <p>Thank you for choosing MediCare!</p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending confirmation email:', error);
        return res.status(500).json({ error: 'Appointment booked, but failed to send confirmation email.' });
      }
      console.log('Confirmation email sent:', info.response);
      res.json({ success: true, message: 'Appointment booked successfully. Confirmation email sent.' });
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ error: 'Error booking appointment. Try again.' });
  }
});

// 🏥 **Get All Appointments**
app.get('/appointments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM appointments ORDER BY appointment_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Error fetching appointments.' });
  }
});

// Send OTP
app.post('/send-otp', async (req, res) => {
  const { email, fullname } = req.body;

  try {
    const otp = generateOTP();
    otpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for Registration',
      text: `Hi ${fullname},\n\nYour OTP for registration is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nBest regards,\nYour Team`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
      }
      res.json({ success: true, message: 'OTP sent successfully.' });
    });
  } catch (err) {
    console.error('Error generating OTP:', err);
    res.status(500).json({ error: 'An error occurred while generating OTP.' });
  }
});

// Login API
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
      return res.json({ success: true });
    } else {
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
