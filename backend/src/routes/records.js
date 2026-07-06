const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const recordsController = require('../controllers/records');

const upload = multer({ storage: multer.memoryStorage() });

const companyRecordsRouter = express.Router();
companyRecordsRouter.use(authenticate);
companyRecordsRouter.post('/:id/records', upload.single('file'), recordsController.createRecord);
companyRecordsRouter.get('/:id/records', recordsController.listRecords);

const recordRouter = express.Router();
recordRouter.use(authenticate);
recordRouter.get('/:id', recordsController.getRecord);
recordRouter.delete('/:id', recordsController.deleteRecord);

module.exports = { companyRecordsRouter, recordRouter };
