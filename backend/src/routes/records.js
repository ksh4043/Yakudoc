const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const recordsController = require('../controllers/records');
const tagsController = require('../controllers/tags');

const upload = multer({ storage: multer.memoryStorage() });

const companyRecordsRouter = express.Router();
companyRecordsRouter.use(authenticate);
companyRecordsRouter.post('/:id/records', upload.single('file'), recordsController.createRecord);
companyRecordsRouter.get('/:id/records', recordsController.listRecords);

const recordRouter = express.Router();
recordRouter.use(authenticate);
// '/:id'보다 먼저 선언해 'bulk-delete'가 :id로 잡히지 않게 한다
recordRouter.post('/bulk-delete', recordsController.bulkDeleteRecords);
recordRouter.get('/:id', recordsController.getRecord);
recordRouter.delete('/:id', recordsController.deleteRecord);
recordRouter.post('/:id/tags', tagsController.addRecordTag);
recordRouter.delete('/:id/tags/:tagId', tagsController.removeRecordTag);

module.exports = { companyRecordsRouter, recordRouter };
