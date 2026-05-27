const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getCollections, createCollection, getDailySummary } = require('../controllers/collectionController');

router.get('/', authenticate, getCollections);
router.post('/', authenticate, authorize('admin','collection_agent','farm_manager'), createCollection);
router.get('/summary', authenticate, getDailySummary);

module.exports = router;
