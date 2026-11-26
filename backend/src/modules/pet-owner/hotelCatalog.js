import { queryAll } from '../pet-transport/db.js';

export async function listHotelRoomCatalog() {
  const rows = await queryAll(
    `SELECT t.id, t.species, t.size_code AS sizeCode, t.title_th AS titleTh,
            t.description_th AS descriptionTh, t.image_url AS imageUrl,
            t.max_pets_per_unit AS maxPetsPerUnit, t.total_units AS totalUnits, t.sort_order AS sortOrder,
            p.price
     FROM dbo.hotel_room_types t
     INNER JOIN dbo.hotel_room_prices p ON p.room_id = t.id
     ORDER BY t.sort_order`,
  );
  return rows.map((row) => ({
    id: row.id,
    species: row.species,
    sizeCode: row.sizeCode,
    titleTh: row.titleTh,
    descriptionTh: row.descriptionTh,
    imageUrl: row.imageUrl,
    maxPetsPerUnit: Number(row.maxPetsPerUnit),
    totalUnits: Number(row.totalUnits),
    sortOrder: Number(row.sortOrder),
    price: Number(row.price),
  }));
}