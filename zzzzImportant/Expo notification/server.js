import express from 'express';
import cors from 'cors';
import { Expo } from 'expo-server-sdk';
import os from 'os';

const app = express();
app.use(cors());
app.use(express.json());

// Create a new Expo SDK client
const expo = new Expo();

app.post('/trigger-notification', async (req, res) => {
  try {
    // Extract the Expo push token from the request
    const { token } = req.body;
    console.log("Received token:", token);

    // Check that the token is a valid Expo push token
    if (!Expo.isExpoPushToken(token)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid Expo push token' 
      });
      return;
    }

    // Construct the message
    const messages = [{
      to: token,
      sound: 'default',
      title: 'Button Pressed!',
      body: 'The button on the app has been pressed.',
      data: { withSome: 'data' }
    }];

    // Send the messages
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    // Send each chunk
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending chunk:', error);
      }
    }

    // Check the tickets for errors
    const receiptIds = [];
    for (const ticket of tickets) {
      // NOTE: Not all tickets may be successful
      if (ticket.id) {
        receiptIds.push(ticket.id);
      }
    }

    // Optionally, later check the receipts
    // const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

    console.log('Notification sent successfully');
    res.status(200).json({ 
      success: true, 
      message: 'Notification sent',
      tickets 
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`Server running on port ${PORT}`);
// });

app.listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(item => !item.internal && item.family === 'IPv4')
    .map(item => item.address);
  
  console.log(`Server running on port ${PORT}`);
  console.log('Available on:');
  addresses.forEach(addr => console.log(`http://${addr}:${PORT}`));
});