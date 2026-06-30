const express = require('express');
const { authenticate } = require('../middleware/auth');
const companiesController = require('../controllers/companies');

const router = express.Router();

router.use(authenticate);

router.get('/', companiesController.getCompanies);
router.post('/', companiesController.createCompany);
router.get('/:id', companiesController.getCompany);
router.patch('/:id', companiesController.updateCompany);
router.delete('/:id', companiesController.deleteCompany);
router.post('/:id/members', companiesController.addMember);
router.delete('/:id/members/:userId', companiesController.removeMember);

module.exports = router;
