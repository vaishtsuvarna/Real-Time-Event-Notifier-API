const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const cron = require('node-cron');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

const port = 3000;

const events = []; 
const completedEvents = []; 


const wss = new WebSocket.Server({ noServer: true });


app.post('/events', (req, res) => {
    const { title, description, time } = req.body;

    if (!title || !time) {
        return res.status(400).json({ error: 'Title and time are required' });
    }

    const event = { id: Date.now(), title, description, time: new Date(time), notified: false };
    events.push(event);
    events.sort((a, b) => new Date(a.time) - new Date(b.time));

    res.status(201).json({ message: 'Event created', event });
});

// Fetch Events Endpoint
app.get('/events', (req, res) => {
    const upcomingEvents = events.filter((event) => new Date(event.time) > new Date());
    res.status(200).json(upcomingEvents);
});

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the Event Notifier API!');
});

// Start the server
const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

// WebSocket upgrade handling
server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

// Cron job to notify about events and log completed ones


cron.schedule('* * * * *', () => {
    const now = new Date();
    events.forEach((event) => {
        const timeDiff = new Date(event.time) - now;

        // Notify 5 minutes before the event
        if (timeDiff <= 5 * 60 * 1000 && !event.notified) {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(`Reminder: ${event.title} starts in 5 minutes!`);
                }
            });
            event.notified = true;
        }

        // Log completed events
        if (timeDiff <= 0) {
            completedEvents.push(event);
            fs.appendFile('completedEvents.log', JSON.stringify(event) + '\n', (err) => {
                if (err) console.error('Error saving event:', err);
            });
        }
    });

    // Remove completed events
    events.splice(0, events.findIndex((event) => new Date(event.time) > now));
});


