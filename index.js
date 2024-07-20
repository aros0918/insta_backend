const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { launchBrowser } = require('./launchBrowser');
const { login } = require('./login');
const { downloadInstagram } = require('./downloadInstagram');
const { metadataCleaner } = require('./metadataCleaner');
const { zipFiles } = require('./utils');
const { regiserUser, getUserByEmail, updateUserPlanAndCredits, updateCredits } = require('./users.api');
const { jwtSecret } = require('./config');
const { authMiddleware } = require('./authMiddleware');
const cors = require('cors');
const app = express();
const port = 3004;
require('dotenv').config();
const stripe = require('stripe')('sk_test_51Pcud0IgR4jDCRDTM0WtrIbDVdi71jGECuTnapQY8EpdMeB49Qiic35P9POsoKNFU4QXfDEJeJn8D8LYKnfbexPP00OLREidE9');
const endpointSecret = 'whsec_f4103f88f7a41dd5892ccb98e72dae3ca79de65870270beafe67070be9f2a12e';
let paymentStatus = '';
// Ensure directories exist
const ensureDirectoryExistence = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDirectoryExistence(path.resolve(__dirname, 'downloads'));
ensureDirectoryExistence(path.resolve(__dirname, 'cleaned'));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '50mb' }));

// serve static assets normally
app.use(express.static(__dirname + '/dist'));

// handle every other route with index.html, which will contain
// a script tag to your application's JavaScript file(s).
app.get('*', function (request, response) {
    response.sendFile(path.resolve(__dirname, './dist/index.html'));
});

app.post('/login', express.json(), async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await getUserByEmail(email);
        if (!user) {
            throw new Error('Not correct email or password');
        }

        const [salt, hash] = user.password.split(':');

        const match = await bcrypt.compare(password, hash);

        if (!match) {
            throw new Error('Not correct email or password');
        }

        res.status(200).send({
            success: true,
            data: {
                token: jwt.sign({ email: user.email }, jwtSecret),
                credits: user.credits,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(400).send({ success: false });
    }
});

app.post('/register', express.json(), async (req, res) => {
    try {
        const { email, password } = req.body;

        const saltRounds = 10;
        const salt = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(password, salt);

        await regiserUser(email, `${salt}:${hash}`);

        res.status(200).send({
            success: true,
            data: {
                token: jwt.sign({ email }, jwtSecret),
                credits: 0,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(400).send({ success: false });
    }
});

app.post('/save-video', authMiddleware, (req, res) => {
    const filePath = path.resolve(__dirname, 'downloads', `${Date.now()}.mp4`);
    fs.writeFile(filePath, req.body, (err) => {
        if (err) {
            console.error('Error saving video:', err);
            res.status(500).send('Error saving video');
        } else {
            res.status(200).send('Video saved successfully');
        }
    });
});

app.post('/download', express.json(), authMiddleware, async (req, res) => {
    const { username, password, targetUsername, maxReels, reelUrl } = req.body;
    let browser;
    try {
        browser = await launchBrowser();

        if (username && password) {
            const loginPage = await browser.newPage();
            await login(loginPage, username, password);
        }

        const reels = await downloadInstagram(browser, targetUsername, parseInt(maxReels), reelUrl);
        const cleanedReels = await metadataCleaner(reels);

        const downloadedFilePaths = [...reels, ...cleanedReels];
        const zipFilePath = './output.zip';

        // Zip downloaded files
        await zipFiles(downloadedFilePaths, zipFilePath);
        console.log(`Zipped files to ${zipFilePath}`);

        res.download(zipFilePath, 'downloaded_files.zip', async (err) => {
            if (err) {
                console.error('Error sending the file:', err);
                res.status(500).send('Error downloading the file.');
            } else {
                console.log('Download and Cleaning Completed!');
            }
        });
    } catch (error) {
        console.error('An error occurred:', error);
        res.status(500).send('An error occurred during the process.');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (request, response) => {
    const sig = request.headers['stripe-signature'];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      console.log(`Webhook signature verification failed:`, err.message);
      paymentStatus = "fail";
      return response.sendStatus(400);
    }
  
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Payment was successful!', session);
        paymentStatus = 'success';
        const paidAmount = session.amount_total / 100; 
        const emailAddress = session.customer_details.email;
        console.log("email", emailAddress);
        let result;
        const subscriptionId = session.subscription;
        if (paidAmount === 99 || paidAmount === 149) {
            const user = await getUserByEmail(emailAddress);
            if (user) {
              const newPlan = paidAmount === 99 ? 'Kickstarter' : 'Pro';
              result = await updateUserPlanAndCredits(emailAddress, newPlan, user.credits, subscriptionId);
            } else {
              console.error(`User not found for email: ${emailAddress}`);
            }
          } else {
            console.error(`Unsupported payment amount: ${paidAmount}`);
          }
        break;
      // ... handle other event types
      default:
      
        console.log(`Unhandled event type ${event.type}`);
    }
    // Return a 200 response to acknowledge receipt of the event
    response.sendStatus(200);
});
app.post('/payment-status', express.json(), async (req, res) => {
    const { email } = req.body;
    const user = await getUserByEmail(email);
    console.log("hello")
    res.json({ status: paymentStatus, plan : user.currentPlan });
    paymentStatus = '';
});
app.post('/update-credits', express.json(), async (req, res) => {
    const { email, credits } = req.body;
    const user = await getUserByEmail(email);
    console.log("check here");
    console.log(user.credits);
    result = await updateCredits(user.email, credits);
    const user_other = await getUserByEmail(user.email);

    console.log(user_other.credits);

    res.json({ credits : user_other.credits});
})
app.post('/get-credits', express.json(), async (req, res) => {
    const { email } = req.body;
    const user = await getUserByEmail(email);
    console.log("check here");
    console.log(user.credits);
    res.json({ credits : user.credits});
})
app.post('/cancel', express.json(), async (req, res) => {
    const { email } = req.body;
    const user = await getUserByEmail(email);
    const subscriptionId = user.subID;
    try {
        const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
        console.log(`Subscription canceled: ${canceledSubscription.id}`);
        await updateUserPlanAndCredits(email, "Free", user.credits, null);
        paymentStatus = "cancel";
        res.json({ success: true});
    } catch (error) {
        console.error('Error canceling subscription:', error);
        res.json({ success: false});
        throw error;
    }
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
