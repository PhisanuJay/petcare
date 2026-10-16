import { Router } from 'express';

import petOwnerRouter from '../modules/pet-owner/routes.js';
import veterinarianRouter from '../modules/veterinarian/routes.js';
import medicalAssistantRouter from '../modules/medical-assistant/routes.js';
import petProfileRouter from '../modules/pet-profile/routes.js';
import petHotelRouter from '../modules/pet-hotel/routes.js';
import petTransportRouter from '../modules/pet-transport/routes.js';
import adoptionRouter from '../modules/adoption/routes.js';
import adminRouter from '../modules/admin/routes.js';
import superAdminRouter from '../modules/super-admin/routes.js';

/**
 * Mount each role module under its own API prefix.
 * Keep modules separated so frontend/backend work does not mix.
 */
export function registerRoutes(app) {
  const api = Router();

  api.use('/pet-owner', petOwnerRouter);
  api.use('/veterinarian', veterinarianRouter);
  api.use('/medical-assistant', medicalAssistantRouter);
  api.use('/pet-profile', petProfileRouter);
  api.use('/pet-hotel', petHotelRouter);
  api.use('/pet-transport', petTransportRouter);
  api.use('/adoption', adoptionRouter);
  api.use('/admin', adminRouter);
  api.use('/super-admin', superAdminRouter);

  app.use('/api', api);
}
