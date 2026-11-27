import { migrateHotelReservationsFromJson } from '../src/modules/pet-owner/hotelLegacyMigrate.js';
import { ensurePetTransportReady } from '../src/modules/pet-transport/routes.js';

await ensurePetTransportReady();
const result = await migrateHotelReservationsFromJson();
console.log(result);
process.exit(0);