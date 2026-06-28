const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const usersController = require('../controllers/users');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/', usersController.getUsers);
router.post('/', usersController.createUser);
router.patch('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
