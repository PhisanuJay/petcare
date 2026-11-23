import { Router } from 'express';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getCustomerSession, requireCustomer } from '../auth/store.js';

const router = Router();
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const STAFF_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const staffSessions = new Map();
const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

function requireAdoptionStaff(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const expiresAt = token ? staffSessions.get(token) : null;

  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) staffSessions.delete(token);
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบพนักงานใหม่' });
  }

  return next();
}

function isSupportedImageDataUrl(value) {
  const match = typeof value === 'string'
    ? value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
    : null;
  if (!match) return false;

  const image = Buffer.from(match[2], 'base64');
  const isJpeg = match[1] === 'jpeg' && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng = match[1] === 'png' && image.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const isWebp = match[1] === 'webp' && image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP';

  return image.length <= MAX_IMAGE_BYTES && (isJpeg || isPng || isWebp);
}

function publicAnimal(animal, currentUserId = '') {
  const { ownerId, ...data } = animal;
  return { ...data, isOwner: Boolean(currentUserId && ownerId === currentUserId) };
}

function parseAnimalFields(body) {
  const {
    name,
    species,
    sex,
    age,
    color,
    vaccination,
    vaccinationDetails = '',
    disease,
    address,
    additionalInfo = '',
    photo = '',
  } = body ?? {};
  const requiredFields = [
    [name, 100],
    [age, 50],
    [color, 100],
    [disease, 500],
    [address, 300],
  ];

  if (
    requiredFields.some(([value, maxLength]) =>
      typeof value !== 'string' || !value.trim() || value.length > maxLength,
    ) ||
    typeof additionalInfo !== 'string' ||
    additionalInfo.length > 1000 ||
    !['ฉีดแล้ว', 'ยังไม่ได้ฉีด'].includes(vaccination) ||
    typeof vaccinationDetails !== 'string' ||
    vaccinationDetails.length > 500 ||
    (vaccination === 'ฉีดแล้ว' && !vaccinationDetails.trim()) ||
    (vaccination === 'ยังไม่ได้ฉีด' && vaccinationDetails.trim()) ||
    !['สุนัข', 'แมว', 'อื่นๆ'].includes(species) ||
    !['male', 'female'].includes(sex)
  ) {
    return { error: 'กรุณากรอกข้อมูลสัตว์ให้ครบถ้วน' };
  }

  return {
    fields: {
      name: name.trim(),
      species,
      sex,
      age: age.trim(),
      color: color.trim(),
      vaccination,
      vaccinationDetails: vaccinationDetails.trim(),
      disease: disease.trim(),
      address: address.trim(),
      additionalInfo: additionalInfo.trim(),
      photo,
    },
  };
}

const animals = [
  {
    id: 'adopt-001',
    name: 'น้องถั่วเหลือง',
    species: 'สุนัข',
    breed: 'พันธุ์ผสม',
    sex: 'female',
    age: '1 ปี',
    color: 'น้ำตาลอ่อน',
    vaccination: 'ฉีดวัคซีนแล้ว',
    disease: 'ไม่มีโรคประจำตัว',
    additionalInfo: '',
    personality: 'ขี้อ้อน ชอบเล่นกับเด็ก',
    location: 'กรุงเทพฯ',
    emoji: '🐕',
    cardColor: '#fff1c9',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
    status: 'available',
  },
  {
    id: 'adopt-002',
    name: 'น้องมะลิ',
    species: 'แมว',
    breed: 'ขาวมณี',
    sex: 'female',
    age: '8 เดือน',
    color: 'ขาว',
    vaccination: 'ฉีดวัคซีนแล้ว',
    disease: 'ไม่มีโรคประจำตัว',
    additionalInfo: '',
    personality: 'เรียบร้อย ชอบนอนตัก',
    location: 'นนทบุรี',
    emoji: '🐈',
    cardColor: '#e7f1ff',
    tags: ['ฉีดวัคซีนแล้ว'],
    status: 'available',
  },
  {
    id: 'adopt-003',
    name: 'น้องดำ',
    species: 'สุนัข',
    breed: 'ไทย',
    sex: 'male',
    age: '2 ปี',
    color: 'ดำ',
    vaccination: 'ฉีดวัคซีนแล้ว',
    disease: 'ไม่มีโรคประจำตัว',
    additionalInfo: '',
    personality: 'ฉลาด เป็นมิตรกับคนคุ้นเคย',
    location: 'ปทุมธานี',
    emoji: '🐶',
    cardColor: '#dff5e8',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
    status: 'available',
  },
  {
    id: 'adopt-004',
    name: 'น้องส้มโอ',
    species: 'แมว',
    breed: 'แมวส้ม',
    sex: 'male',
    age: '3 เดือน',
    color: 'ส้ม',
    vaccination: 'ถ่ายพยาธิแล้ว',
    disease: 'ไม่มีโรคประจำตัว',
    additionalInfo: '',
    personality: 'ซน ขี้เล่น เข้ากับแมวตัวอื่นได้',
    location: 'กรุงเทพฯ',
    emoji: '🐱',
    cardColor: '#ffe6d9',
    tags: ['ถ่ายพยาธิแล้ว'],
    status: 'available',
  },
  {
    id: 'adopt-005',
    name: 'น้องโมจิ',
    species: 'สุนัข',
    breed: 'พันธุ์ผสม',
    sex: 'male',
    age: '6 เดือน',
    color: 'ขาวน้ำตาล',
    vaccination: 'ตรวจสุขภาพแล้ว',
    disease: 'ไม่มีโรคประจำตัว',
    additionalInfo: '',
    personality: 'ร่าเริง ชอบเดินเล่น',
    location: 'สมุทรปราการ',
    emoji: '🐕',
    cardColor: '#f6e0ff',
    tags: ['ตรวจสุขภาพแล้ว'],
    status: 'available',
  },
  {
    id: 'adopt-006',
    name: 'น้องข้าวปั้น',
    species: 'แมว',
    breed: 'แมวสามสี',
    sex: 'female',
    age: '1 ปี 6 เดือน',
    color: 'สามสี',
    vaccination: 'ฉีดวัคซีนแล้ว',
    disease: 'ไม่มีโรคประจำตัว',
    additionalInfo: '',
    personality: 'ใจเย็น ชอบอยู่ใกล้คน',
    location: 'นนทบุรี',
    emoji: '🐈',
    cardColor: '#dff3fb',
    tags: ['ฉีดวัคซีนแล้ว', 'ทำหมันแล้ว'],
    status: 'available',
  },
];

const applications = [];

router.get('/', (_req, res) => {
  res.json({ module: 'adoption', status: 'ok' });
});

router.get('/animals', (req, res) => {
  const customerSession = getCustomerSession(req);
  res.json({
    animals: animals
      .filter((animal) => animal.status === 'available')
      .map((animal) => publicAnimal(animal, customerSession?.user.id)),
  });
});

router.post('/staff/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const configuredEmail = process.env.ADOPTION_STAFF_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADOPTION_STAFF_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าบัญชีพนักงานใน Backend' });
  }

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !safeEqual(email.trim().toLowerCase(), configuredEmail) ||
    !safeEqual(password, configuredPassword)
  ) {
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  const now = Date.now();
  for (const [sessionToken, expiresAt] of staffSessions) {
    if (expiresAt <= now) staffSessions.delete(sessionToken);
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = now + STAFF_SESSION_DURATION_MS;
  staffSessions.set(token, expiresAt);
  return res.json({ token, expiresAt: new Date(expiresAt).toISOString() });
});

router.get('/staff/session', requireAdoptionStaff, (_req, res) => {
  res.json({ ok: true });
});

router.get('/staff/overview', requireAdoptionStaff, (_req, res) => {
  res.json({
    availableAnimals: animals.filter((animal) => animal.status === 'available').length,
    adoptedAnimals: animals.filter((animal) => animal.status === 'adopted').length,
    pendingRequests: applications.filter((application) => application.status === 'pending').length,
    totalRequests: applications.length,
  });
});

router.get('/staff/animals', requireAdoptionStaff, (_req, res) => {
  res.json({ animals: animals.map((animal) => publicAnimal(animal)) });
});

router.patch('/staff/animals/:animalId/status', requireAdoptionStaff, (req, res) => {
  const { status } = req.body ?? {};
  if (!['available', 'adopted'].includes(status)) {
    return res.status(400).json({ error: 'สถานะสัตว์ไม่ถูกต้อง' });
  }

  const animal = animals.find((item) => item.id === req.params.animalId);
  if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });

  animal.status = status;
  animal.adoptedAt = status === 'adopted' ? new Date().toISOString() : null;
  if (status === 'adopted') {
    for (const application of applications) {
      if (application.animalId === animal.id && application.status === 'pending') {
        application.status = 'closed';
        application.resolutionNote = 'สัตว์เลี้ยงมีบ้านแล้ว';
        application.decidedAt = animal.adoptedAt;
      }
    }
  }

  return res.json({ animal: publicAnimal(animal) });
});

router.post('/animals', requireCustomer, (req, res) => {
  const parsed = parseAnimalFields(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (!isSupportedImageDataUrl(parsed.fields.photo)) {
    return res.status(400).json({ error: 'รูปภาพต้องเป็น JPEG, PNG หรือ WebP และขนาดไม่เกิน 3 MB' });
  }

  const animal = {
    id: randomUUID(),
    ...parsed.fields,
    breed: '',
    vaccination: parsed.fields.vaccination.trim(),
    location: parsed.fields.address,
    personality: '',
    cardColor: '#e7f1ff',
    tags: [],
    status: 'available',
    ownerId: req.customer.id,
    createdAt: new Date().toISOString(),
  };
  animals.push(animal);

  return res.status(201).json({ animal: publicAnimal(animal, req.customer.id) });
});

router.patch('/animals/:animalId', requireCustomer, (req, res) => {
  const animal = animals.find((item) => item.id === req.params.animalId);
  if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });
  if (animal.ownerId !== req.customer.id) {
    return res.status(403).json({ error: 'แก้ไขได้เฉพาะโพสต์ที่คุณเป็นเจ้าของเท่านั้น' });
  }
  if (animal.status !== 'available') {
    return res.status(409).json({ error: 'แก้ไขได้เฉพาะโพสต์ที่ยังหาบ้านอยู่' });
  }

  const parsed = parseAnimalFields(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (parsed.fields.photo && !isSupportedImageDataUrl(parsed.fields.photo)) {
    return res.status(400).json({ error: 'รูปภาพต้องเป็น JPEG, PNG หรือ WebP และขนาดไม่เกิน 3 MB' });
  }

  Object.assign(animal, parsed.fields, {
    photo: parsed.fields.photo || animal.photo,
    location: parsed.fields.address,
    updatedAt: new Date().toISOString(),
  });
  return res.json({ animal: publicAnimal(animal, req.customer.id) });
});

router.post('/applications', (req, res) => {
  const {
    animalId,
    firstName,
    lastName,
    age,
    occupation,
    phone,
    salary,
    salaryStatementPhoto,
    housingType,
    homePhoto,
    hasCats,
    catCount,
  } = req.body ?? {};
  const animal = animals.find((item) => item.id === animalId && item.status === 'available');

  if (!animal) {
    return res.status(404).json({ error: 'ไม่พบน้องที่เปิดรับบ้านอยู่' });
  }

  if (
    typeof firstName !== 'string' ||
    !firstName.trim() ||
    firstName.trim().length > 100 ||
    typeof lastName !== 'string' ||
    !lastName.trim() ||
    lastName.trim().length > 100 ||
    !Number.isInteger(age) ||
    age < 1 ||
    age > 120 ||
    typeof occupation !== 'string' ||
    !occupation.trim() ||
    occupation.trim().length > 100 ||
    typeof phone !== 'string' ||
    !phone.trim() ||
    phone.trim().length > 30 ||
    !Number.isSafeInteger(salary) ||
    salary < 0 ||
    !['บ้าน', 'คอนโด', 'หอพัก'].includes(housingType) ||
    typeof hasCats !== 'boolean' ||
    (hasCats && (!Number.isInteger(catCount) || catCount < 1 || catCount > 100)) ||
    (!hasCats && catCount !== null)
  ) {
    return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก' });
  }

  if (!isSupportedImageDataUrl(homePhoto)) {
    return res.status(400).json({ error: 'รูปสภาพบ้านต้องเป็น JPEG, PNG หรือ WebP และขนาดไม่เกิน 3 MB' });
  }

  if (!isSupportedImageDataUrl(salaryStatementPhoto)) {
    return res.status(400).json({ error: 'รูป Statement เงินเดือนต้องเป็น JPEG, PNG หรือ WebP และขนาดไม่เกิน 3 MB' });
  }

  const application = {
    id: randomUUID(),
    animalId: animal.id,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    age,
    occupation: occupation.trim(),
    phone: phone.trim(),
    salary,
    salaryStatementPhoto,
    housingType,
    homePhoto,
    hasCats,
    catCount: hasCats ? catCount : null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  applications.push(application);

  return res.status(201).json({
    message: 'ส่งคำขอรับเลี้ยงเรียบร้อยแล้ว',
    application: { id: application.id, animalId: application.animalId, createdAt: application.createdAt },
  });
});

router.get('/staff/requests', requireAdoptionStaff, (_req, res) => {
  const requests = applications
    .map((application) => ({
      id: application.id,
      animalId: application.animalId,
      animalName: animals.find((animal) => animal.id === application.animalId)?.name || '',
      firstName: application.firstName,
      lastName: application.lastName,
      status: application.status,
      createdAt: application.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ requests });
});

router.get('/staff/requests/:requestId', requireAdoptionStaff, (req, res) => {
  const application = applications.find((item) => item.id === req.params.requestId);
  if (!application) return res.status(404).json({ error: 'ไม่พบคำร้องขอรับเลี้ยง' });
  const animal = animals.find((item) => item.id === application.animalId);
  return res.json({ request: application, animal: animal ? publicAnimal(animal) : null });
});

router.patch('/staff/requests/:requestId', requireAdoptionStaff, (req, res) => {
  const { status } = req.body ?? {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'ผลการพิจารณาไม่ถูกต้อง' });
  }

  const application = applications.find((item) => item.id === req.params.requestId);
  if (!application) return res.status(404).json({ error: 'ไม่พบคำร้องขอรับเลี้ยง' });
  if (application.status !== 'pending') {
    return res.status(409).json({ error: 'คำร้องนี้ได้รับการพิจารณาแล้ว' });
  }

  const animal = animals.find((item) => item.id === application.animalId);
  if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });
  if (status === 'approved' && animal.status !== 'available') {
    return res.status(409).json({ error: 'สัตว์เลี้ยงมีบ้านแล้ว ไม่สามารถอนุมัติคำร้องนี้ได้' });
  }

  const decidedAt = new Date().toISOString();
  application.status = status;
  application.decidedAt = decidedAt;

  if (status === 'approved') {
    animal.status = 'adopted';
    animal.adoptedAt = decidedAt;
    for (const otherApplication of applications) {
      if (
        otherApplication.id !== application.id &&
        otherApplication.animalId === animal.id &&
        otherApplication.status === 'pending'
      ) {
        otherApplication.status = 'closed';
        otherApplication.resolutionNote = 'สัตว์เลี้ยงมีบ้านแล้ว';
        otherApplication.decidedAt = decidedAt;
      }
    }
  }

  return res.json({ request: application, animal });
});

router.get('/add-animal', (_req, res) => {
  res.json({ module: 'adoption', page: 'add-animal', status: 'placeholder' });
});

router.get('/requests', (_req, res) => {
  res.json({ module: 'adoption', page: 'requests', status: 'placeholder' });
});

export default router;
