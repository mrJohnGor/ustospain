const express = require('express');
const router = express.Router();
const Property = require('../models/Property');

// Get all properties
router.get('/', async (req, res) => {
  try {
    const properties = await Property.find();
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new property
router.post('/', async (req, res) => {
  const property = new Property({
    title: req.body.title,
    location: req.body.location,
    price: req.body.price,
    type: req.body.type,
    bedrooms: req.body.bedrooms,
    bathrooms: req.body.bathrooms,
    area: req.body.area,
    description: req.body.description,
    images: req.body.images,
    contact: req.body.contact
  });

  try {
    const newProperty = await property.save();
    res.status(201).json(newProperty);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;