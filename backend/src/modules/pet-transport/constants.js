export const ZONES = [
  { id: '1', label: 'Zone 1', price: 100 },
  { id: '2', label: 'Zone 2', price: 150 },
];

export const SERVICE_SUBDISTRICTS = [
  { id: 'chatuchak', districtId: 'chatuchak', label: 'แขวงจตุจักร', zoneId: '1' },
  { id: 'chomphon', districtId: 'chatuchak', label: 'แขวงจอมพล', zoneId: '1' },
  { id: 'latyao', districtId: 'chatuchak', label: 'แขวงลาดยาว', zoneId: '2' },
  { id: 'chantharakasem', districtId: 'chatuchak', label: 'แขวงจันทรเกษม', zoneId: '2' },
];

export const TRIP_STATUSES = [
  { id: 'assigned', label: 'มอบหมายแล้ว', step: 1 },
  { id: 'en_route_pickup', label: 'กำลังไปรับ', step: 2 },
  { id: 'arrived_pickup', label: 'ถึงจุดรับ', step: 3 },
  { id: 'picked_up', label: 'รับสัตว์แล้ว', step: 4 },
  { id: 'in_transit', label: 'กำลังเดินทาง', step: 5 },
  { id: 'arrived_dropoff', label: 'ถึงจุดส่ง', step: 6 },
  { id: 'completed', label: 'ส่งสำเร็จ', step: 7 },
];

export const DEMO_CLINICS = [
  {
    id: 'clinic-1',
    name: 'คลินิกมะแอ่ว',
    address: '99/9 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900',
    districtId: 'chatuchak',
    subdistrictId: 'chatuchak',
    zoneId: '1',
  },
];

export const DEMO_HOTELS = [
  {
    id: 'hotel-1',
    name: 'PetCare Hotel ลาดยาว',
    address: '45 ถ.วิภาวดี แขวงลาดยาว',
    districtId: 'chatuchak',
    subdistrictId: 'latyao',
    zoneId: '2',
  },
  {
    id: 'hotel-2',
    name: 'Cat Nest จันทรเกษม',
    address: '12 ถ.ประดิพัทธ์ แขวงจันทรเกษม',
    districtId: 'chatuchak',
    subdistrictId: 'chantharakasem',
    zoneId: '2',
  },
];

export function isRoundTrip(serviceType) {
  return serviceType === 'round_trip';
}

export function tripStatusMeta(id) {
  return TRIP_STATUSES.find((s) => s.id === id) ?? TRIP_STATUSES[0];
}

export function nextTripStatus(currentId) {
  const i = TRIP_STATUSES.findIndex((s) => s.id === currentId);
  if (i < 0 || i >= TRIP_STATUSES.length - 1) return null;
  return TRIP_STATUSES[i + 1];
}
