const authController = require('./auth.controller');
const storeController = require('./store.controller');
const screeningController = require('./screening.controller');
const userActivityController = require('./userActivity.controller');
const uploadController = require('./upload.controller');
const syncController = require('./sync.controller');

module.exports = {
  authController,
  storeController,
  screeningController,
  userActivityController,
  uploadController,
  syncController,
};