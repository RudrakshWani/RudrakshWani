// backend-server/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer'); 
const admin = require('firebase-admin'); // Import Firebase Admin SDK

// Load environment variables from .env file (for local development)
// This line is primarily for local testing. Railway handles env vars directly.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use port from environment variable or default to 3000

// --- Firebase Initialization ---
// Parse the service account key JSON string from environment variable
let serviceAccount;
try {
    // The service account key is stored as a JSON string in a single environment variable.
    // We parse it back into a JavaScript object here.
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (e) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    // If the key is invalid, the server cannot connect to Firebase.
    // In a production environment, you might want to gracefully handle this or exit.
    // For now, we'll log and let the app try to run, but Firestore operations will fail.
    console.error("Firebase Admin SDK will not be initialized. Check your FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
    serviceAccount = null; // Set to null to prevent initialization if parsing fails
}

if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // You can also specify databaseURL if using Realtime Database, but not strictly needed for Firestore.
      // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` 
    });
    console.log("Firebase Admin SDK initialized successfully.");
} else {
    console.error("Firebase Admin SDK could not be initialized due to missing or invalid service account key.");
}

const db = serviceAccount ? admin.firestore() : null; // Get a reference to the Firestore database only if Firebase initialized

// Define Firestore collection names from environment variables
// These provide flexibility to change collection names without code changes.
const CONTACTS_COLLECTION = process.env.FIRESTORE_COLLECTION_CONTACTS || 'contact_submissions';
const CALLBACKS_COLLECTION = process.env.FIRESTORE_COLLECTION_CALLBACKS || 'callback_requests';

// Middleware
app.use(bodyParser.json()); // To parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: true })); // To parse URL-encoded request bodies

// CORS Configuration
// IMPORTANT: In a real production environment, replace '*' with your actual website domain
// For example: cors({ origin: 'https://www.yourwebsite.com' })
app.use(cors()); 

// Nodemailer Transporter Setup
// This transporter will be used to send emails.
// Credentials will come from Railway environment variables.
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use 'gmail' or other services like 'Outlook365', 'SendGrid', etc.
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address (e.g., shivamsolarpower9@gmail.com)
        pass: process.env.EMAIL_PASS  // Your Gmail App Password (NOT your regular password)
    }
});

// Function to send email
async function sendNotificationEmail(subject, htmlContent) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.RECIPIENT_EMAIL || 'shivamsolarpower9@gmail.com', // Your business email to receive notifications
        subject: subject,
        html: htmlContent
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Notification email sent successfully.');
    } catch (error) {
        console.error('Error sending notification email:', error);
    }
}


// --- Contact Form Submission Endpoint ---
app.post('/submit-contact', async (req, res) => {
    const { contact_name, contact_email, contact_subject, contact_message } = req.body;

    if (!contact_name || !contact_email || !contact_message) {
        return res.status(400).json({ success: false, message: 'Please fill in all required contact fields.' });
    }

    console.log('--- New Contact Form Submission ---');
    console.log(`Name: ${contact_name}`);
    console.log(`Email: ${contact_email}`);
    console.log(`Subject: ${contact_subject || 'N/A'}`);
    console.log(`Message: ${contact_message}`);
    console.log('-----------------------------------');

    const emailSubject = `New Contact Form Submission: ${contact_subject || 'No Subject'}`;
    const emailHtml = `
        <p>You have a new contact form submission from your website:</p>
        <ul>
            <li><strong>Name:</strong> ${contact_name}</li>
            <li><strong>Email:</strong> ${contact_email}</li>
            <li><strong>Subject:</strong> ${contact_subject || 'N/A'}</li>
            <li><strong>Message:</strong> ${contact_message}</li>
        </ul>
        <p>Please respond to them as soon as possible.</p>
    `;

    // Data to save to Firestore
    const formData = {
        type: 'Contact Form',
        timestamp: admin.firestore.FieldValue.serverTimestamp(), // Firestore server timestamp for accurate time
        name: contact_name,
        email: contact_email,
        phone: '', // Not available in contact form
        subject: contact_subject || 'N/A',
        message: contact_message
    };

    try {
        await sendNotificationEmail(emailSubject, emailHtml); // Send email first

        if (db) { // Only attempt to save to Firestore if db object is initialized
            await db.collection(CONTACTS_COLLECTION).add(formData); // Save to Firestore
            console.log('Contact form data saved to Firestore.');
            res.status(200).json({ success: true, message: 'Your contact message has been sent and saved successfully!' });
        } else {
            console.warn('Firestore not initialized, skipping data save.');
            res.status(200).json({ success: true, message: 'Your contact message has been sent successfully! (Data not saved to database due to configuration error)' });
        }
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({ success: false, message: 'Failed to submit contact message. Please try again.' });
    }
});

// --- Call Back Request Form Submission Endpoint ---
app.post('/submit-callback', async (req, res) => {
    const { modal_callback_name, modal_callback_email, modal_callback_phone, modal_contact_method, modal_best_time, modal_callback_message } = req.body;

    if (!modal_callback_name || !modal_callback_email || !modal_callback_phone) {
        return res.status(400).json({ success: false, message: 'Please fill in all required call back fields.' });
    }

    console.log('--- New Call Back Request ---');
    console.log(`Name: ${modal_callback_name}`);
    console.log(`Email: ${modal_callback_email}`);
    console.log(`Phone: ${modal_callback_phone}`);
    console.log(`Preferred Method: ${modal_contact_method}`);
    console.log(`Best Time: ${modal_best_time}`);
    console.log(`Message: ${modal_callback_message || 'N/A'}`);
    console.log('-----------------------------');

    const emailSubject = `New Call Back Request from Website: ${modal_callback_name}`;
    const emailHtml = `
        <p>You have a new call back request from your website:</p>
        <ul>
            <li><strong>Name:</strong> ${modal_callback_name}</li>
            <li><strong>Email:</strong> ${modal_callback_email}</li>
            <li><strong>Phone:</strong> ${modal_callback_phone}</li>
            <li><strong>Preferred Contact Method:</strong> ${modal_contact_method}</li>
            <li><strong>Best Time to Call:</strong> ${modal_best_time}</li>
            <li><strong>Message:</strong> ${modal_callback_message || 'N/A'}</li>
        </ul>
        <p>Please reach out to them as soon as possible.</p>
    `;

    // Data to save to Firestore
    const formData = {
        type: 'Call Back Request',
        timestamp: admin.firestore.FieldValue.serverTimestamp(), // Firestore server timestamp
        name: modal_callback_name,
        email: modal_callback_email,
        phone: modal_callback_phone,
        subject: 'Call Back Request', 
        message: modal_callback_message || 'N/A',
        preferredMethod: modal_contact_method,
        bestTime: modal_best_time
    };

    try {
        await sendNotificationEmail(emailSubject, emailHtml); // Send email first

        if (db) { // Only attempt to save to Firestore if db object is initialized
            await db.collection(CALLBACKS_COLLECTION).add(formData); // Save to Firestore
            console.log('Call back form data saved to Firestore.');
            res.status(200).json({ success: true, message: 'Your call back request has been submitted and saved successfully!' });
        } else {
            console.warn('Firestore not initialized, skipping data save.');
            res.status(200).json({ success: true, message: 'Your call back request has been submitted successfully! (Data not saved to database due to configuration error)' });
        }
    } catch (error) {
        console.error('Error processing call back form:', error);
        res.status(500).json({ success: false, message: 'Failed to submit call back request. Please try again.' });
    }
});

// Simple root route for health check
app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});