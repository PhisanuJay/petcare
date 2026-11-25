/**
 * Adoption animals for Pet Owner pages.
 * No hardcoded samples — list comes empty until animals exist in the Adoption module DB.
 * TODO: replace with MSSQL-backed lookup shared with /api/adoption.
 */

export function listAdoptionAnimals() {
  return Promise.resolve([]);
}

export function findAdoptionAnimal(id) {
  return Promise.resolve(null);
}
