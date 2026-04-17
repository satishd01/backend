const express = require('express');
const router = express.Router();

const {
  createServiceBooking,
  createFoodBooking,
  requestServiceBookingPayment,
  approveServiceBooking,
  rejectServiceBooking,
  getVendorBookings,
  getVendorServiceBookings,
  getVendorFoodBookings,
  updateBookingStatus,
  deleteBooking,
} = require('../controllers/bookingController');

const authenticate = require('../middlewares/authenticate');
const isCustomer = require('../middlewares/isCustomer');
const isAdmin = require('../middlewares/isAdmin');
const isBusinessOwner = require('../middlewares/isBusinessOwner');

router.post('/service', authenticate, isCustomer, createServiceBooking);
router.post('/service/:serviceId', authenticate, isCustomer, createServiceBooking);
router.post('/food', authenticate, isCustomer, createFoodBooking);
router.post('/food/:foodId', authenticate, isCustomer, createFoodBooking);

router.get('/vendor', authenticate, isBusinessOwner, getVendorBookings);
router.get('/vendor/service', authenticate, isBusinessOwner, getVendorServiceBookings);
router.get('/vendor/food', authenticate, isBusinessOwner, getVendorFoodBookings);
router.put('/service/:id/request-payment', authenticate, isBusinessOwner, requestServiceBookingPayment);
router.put('/service/:id/approve', authenticate, isBusinessOwner, approveServiceBooking);
router.put('/service/:id/reject', authenticate, isBusinessOwner, rejectServiceBooking);

router.put('/confirm/:id', authenticate, isBusinessOwner, (req, res) => {
  req.body.status = 'confirmed';
  updateBookingStatus(req, res);
});

router.put('/complete/:id', authenticate, isBusinessOwner, (req, res) => {
  req.body.status = 'completed';
  updateBookingStatus(req, res);
});

router.put('/cancel/:id', authenticate, (req, res) => {
  req.body.status = 'cancelled';
  updateBookingStatus(req, res);
});

router.delete('/:id', authenticate, isAdmin, deleteBooking);

module.exports = router;
