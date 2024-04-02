import express from 'express';
import claimController from "../controller/claim/index.js"
const router = express.Router();

router.post('/restrict_check', claimController.restrict_check);


export default router;