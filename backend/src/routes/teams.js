const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const teamsController = require('../controllers/teams');

const router = express.Router();

router.use(authenticate);

router.get('/', requireAdmin, teamsController.getTeams);
router.post('/', requireAdmin, teamsController.createTeam);
router.patch('/:id', requireAdmin, teamsController.updateTeam);
router.delete('/:id', requireAdmin, teamsController.deleteTeam);
router.get('/:id/members', requireAdmin, teamsController.getTeamMembers);
router.post('/:id/members', requireAdmin, teamsController.addTeamMember);
router.patch('/:id/members/:userId', requireAdmin, teamsController.updateTeamMemberRole);
router.delete('/:id/members/:userId', requireAdmin, teamsController.removeTeamMember);

router.get('/:id/board', teamsController.getTeamBoard);

module.exports = router;
