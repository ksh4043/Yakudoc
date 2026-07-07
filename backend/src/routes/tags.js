const express = require('express');
const { authenticate } = require('../middleware/auth');
const tagsController = require('../controllers/tags');

const router = express.Router();

router.use(authenticate);

router.get('/', tagsController.getTags);
router.post('/', tagsController.createTag);
router.patch('/:id', tagsController.updateTag);
router.delete('/:id', tagsController.deleteTag);

module.exports = router;
