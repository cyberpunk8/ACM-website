// server.js - Express server setup
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/acm_events', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Event Schema
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, required: true, enum: ['workshop', 'hackathon', 'tedtalk', 'meeting', 'orientation', 'other'] },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  description: { type: String, required: true },
  imageUrl: { type: String },
  images: { type: [String] },
  createdAt: { type: Date, default: Date.now }
});

const Event = mongoose.model('Event', eventSchema);

// Storage for multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB file size limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images only!');
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// API Endpoints
// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ startDate: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new event
app.post('/api/events', upload.array('images', 5), async (req, res) => {
    try {
      const event = new Event({
        title: req.body.title,
        type: req.body.type,
        startDate: req.body.startDate,
        endDate: req.body.endDate || null,
        description: req.body.description,
        // Store array of image paths
        images: req.files && req.files.length > 0 ? req.files.map(file => `/uploads/${file.filename}`) : [],
        // For backward compatibility with existing code
        imageUrl: req.files && req.files.length > 0 ? `/uploads/${req.files[0].filename}` : null
      });
      
      const newEvent = await event.save();
      res.status(201).json(newEvent);
    } catch (err) {
      console.error('Error creating event:', err);
      res.status(400).json({ message: err.message });
    }
  });
// Update event
app.put('/api/events/:id', upload.array('images', 5), async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: 'Event not found' });
      
      // Update fields if provided
      if (req.body.title) event.title = req.body.title;
      if (req.body.type) event.type = req.body.type;
      if (req.body.startDate) event.startDate = req.body.startDate;
      if (req.body.endDate) event.endDate = req.body.endDate;
      if (req.body.description) event.description = req.body.description;
      
      // Handle image uploads
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => `/uploads/${file.filename}`);
        event.images = event.images ? [...event.images, ...newImages] : newImages;
        
        // Update imageUrl for backward compatibility
        if (!event.imageUrl && newImages.length > 0) {
          event.imageUrl = newImages[0];
        }
      }
      
      // Handle image removal if specified
      if (req.body.imagesToRemove) {
        try {
          const imagesToRemove = JSON.parse(req.body.imagesToRemove);
          if (Array.isArray(imagesToRemove) && imagesToRemove.length > 0) {
            event.images = event.images.filter(img => !imagesToRemove.includes(img));
            
            // If we removed the main image, update imageUrl
            if (imagesToRemove.includes(event.imageUrl)) {
              event.imageUrl = event.images.length > 0 ? event.images[0] : null;
            }
          }
        } catch (jsonError) {
          console.error('Error parsing imagesToRemove JSON:', jsonError);
        }
      }
      
      const updatedEvent = await event.save();
      res.json(updatedEvent);
    } catch (err) {
      console.error('Error updating event:', err);
      res.status(400).json({ message: err.message });
    }
  });

// Delete event
app.delete('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    
    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});