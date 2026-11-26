import { Router } from 'express';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getCustomerSession, requireCustomer } from '../auth/store.js';
import { findUserByEmail } from '../auth/usersRepository.js';
import { ensureAdoptionReady } from './adoptionBootstrap.js';
import {
  ANIMAL_STATUS,
  APPLICATION_STATUS,
  OPEN_APPLICATION_STATUSES,
} from './adoptionConstants.js';
import {
  adoptionHistory,
  closeOtherApplications,
  countOpenApplicationsForAnimal,
  createAnimalRecord,
  createApplicationRecord,
  findAnimalById,
  findApplicationById,
  listAnimalsByOwner,
  listAnimalsForStaff,
  listApplicationsForStaff,
  listApplicationsForUser,
  listPublicAnimals,
  setAnimalStatus,
  setApplicationStatus,
  staffOverviewCounts,
  updateAnimalRecord,
} from './adoptionRepository.js';

const router = Router();
const scrypt = promisify(scryptCallback);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const STAFF_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const staffSessions = new Map();

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

async function verifyUserPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const expected = Buffer.from(user.passwordHash, 'hex');
  if (!expected.length) return false;
  const candidate = await scrypt(password, user.salt, expected.length);
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function requireAdoptionStaff(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const expiresAt = token ? staffSessions.get(token) : null;

  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) staffSessions.delete(token);
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบพนักงานใหม่' });
  }

  return next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

function isSupportedImageList(photos) {
  if (!photos) return true;
  if (!Array.isArray(photos)) return false;
  return photos.length <= 6 && photos.every((item) => !item || isSupportedImageDataUrl(item));
}

function publicAnimal(animal, currentUserId = '') {
  const { ownerId, statusLog, ...data } = animal;
  const listingStatus = animal.status;
  const legacyStatus =
    listingStatus === ANIMAL_STATUS.published || listingStatus === ANIMAL_STATUS.has_interest
      ? 'available'
      : listingStatus;
  return {
    ...data,
    status: legacyStatus,
    listingStatus,
    isOwner: Boolean(currentUserId && ownerId === currentUserId),
  };
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
    photos = [],
    breed = '',
    weight = '',
    neutered = '',
    healthHistory = '',
    personality = '',
    reason = '',
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
    !['male', 'female'].includes(sex) ||
    (typeof breed === 'string' && breed.length > 120) ||
    (typeof personality === 'string' && personality.length > 500) ||
    (typeof reason === 'string' && reason.length > 1000) ||
    !isSupportedImageList(photos)
  ) {
    return { error: 'กรุณากรอกข้อมูลสัตว์ให้ครบถ้วน' };
  }

  const photoList = Array.isArray(photos) && photos.length
    ? photos.filter(Boolean)
    : photo
      ? [photo]
      : [];

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
      photo: photoList[0] || '',
      photos: photoList,
      breed: typeof breed === 'string' ? breed.trim() : '',
      weight: typeof weight === 'string' ? weight.trim() : '',
      neutered: typeof neutered === 'string' ? neutered.trim() : '',
      healthHistory: typeof healthHistory === 'string' ? healthHistory.trim() : '',
      personality: typeof personality === 'string' ? personality.trim() : '',
      reason: typeof reason === 'string' ? reason.trim() : '',
      location: address.trim(),
      tags: [],
      cardColor: '#e7f1ff',
    },
  };
}

function staffMapAnimalStatus(input) {
  if (input === 'available') return ANIMAL_STATUS.published;
  if (input === 'adopted') return ANIMAL_STATUS.adopted;
  return input;
}

router.use(wrap(async (_req, _res, next) => {
  await ensureAdoptionReady();
  next();
}));

router.get('/', (_req, res) => {
  res.json({ module: 'adoption', status: 'ok', persistence: 'mssql' });
});

router.get('/animals', wrap(async (req, res) => {
  const customerSession = await getCustomerSession(req);
  const animals = await listPublicAnimals();
  res.json({
    animals: animals.map((animal) => publicAnimal(animal, customerSession?.user?.id)),
  });
}));

router.get('/animals/mine', requireCustomer, wrap(async (req, res) => {
  const animals = await listAnimalsByOwner(req.customer.id);
  const withCounts = await Promise.all(animals.map(async (animal) => ({
    ...publicAnimal(animal, req.customer.id),
    interestCount: await countOpenApplicationsForAnimal(animal.id),
  })));
  res.json({ animals: withCounts });
}));

router.post('/staff/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let accepted = false;

    const dbUser = await findUserByEmail(normalizedEmail);
    if (
      dbUser
      && dbUser.active !== false
      && dbUser.role === 'adoption_staff'
      && await verifyUserPassword(password, dbUser)
    ) {
      accepted = true;
    }

    const configuredEmail = process.env.ADOPTION_STAFF_EMAIL?.trim().toLowerCase();
    const configuredPassword = process.env.ADOPTION_STAFF_PASSWORD;
    if (
      !accepted
      && configuredEmail
      && configuredPassword
      && safeEqual(normalizedEmail, configuredEmail)
      && safeEqual(password, configuredPassword)
    ) {
      accepted = true;
    }

    if (!accepted) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const now = Date.now();
    for (const [sessionToken, expiresAt] of staffSessions) {
      if (expiresAt <= now) staffSessions.delete(sessionToken);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = now + STAFF_SESSION_DURATION_MS;
    staffSessions.set(token, expiresAt);
    return res.json({
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      staff: {
        id: dbUser?.id || 'adoption-staff',
        email: normalizedEmail,
        role: 'adoption_staff',
        name: dbUser
          ? [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || normalizedEmail
          : 'พนักงานหาบ้านสัตว์',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/staff/session', requireAdoptionStaff, (_req, res) => {
  res.json({ ok: true });
});

router.get('/staff/overview', requireAdoptionStaff, wrap(async (_req, res) => {
  const counts = await staffOverviewCounts();
  res.json({
    availableAnimals: counts.availableAnimals,
    adoptedAnimals: counts.adoptedAnimals,
    pendingRequests: counts.pendingRequests,
    totalRequests: counts.totalRequests,
    pendingListings: counts.pendingListings,
  });
}));

router.get('/staff/animals', requireAdoptionStaff, wrap(async (req, res) => {
  const status = req.query.status ? staffMapAnimalStatus(String(req.query.status)) : '';
  const animals = await listAnimalsForStaff(status || undefined);
  res.json({ animals: animals.map((animal) => publicAnimal(animal)) });
}));

router.patch('/staff/animals/:animalId/status', requireAdoptionStaff, wrap(async (req, res) => {
  const mapped = staffMapAnimalStatus(req.body?.status);
  if (![ANIMAL_STATUS.published, ANIMAL_STATUS.adopted, ANIMAL_STATUS.rejected].includes(mapped)) {
    return res.status(400).json({ error: 'สถานะสัตว์ไม่ถูกต้อง' });
  }

  const animal = await findAnimalById(req.params.animalId);
  if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });

  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const updated = await setAnimalStatus(animal, mapped, 'adoption_staff', note);

  if (mapped === ANIMAL_STATUS.adopted) {
    await closeOtherApplications(animal.id, '', 'สัตว์เลี้ยงมีบ้านแล้ว');
  }

  return res.json({ animal: publicAnimal(updated) });
}));

router.patch('/staff/animals/:animalId', requireAdoptionStaff, wrap(async (req, res) => {
  const animal = await findAnimalById(req.params.animalId);
  if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });

  const action = req.body?.action;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  if (action === 'approve') {
    const updated = await setAnimalStatus(animal, ANIMAL_STATUS.published, 'adoption_staff', note);
    return res.json({ animal: publicAnimal(updated) });
  }
  if (action === 'reject') {
    const updated = await setAnimalStatus(animal, ANIMAL_STATUS.rejected, 'adoption_staff', note);
    return res.json({ animal: publicAnimal(updated) });
  }
  if (action === 'adopted') {
    const updated = await setAnimalStatus(animal, ANIMAL_STATUS.adopted, 'adoption_staff', note);
    await closeOtherApplications(animal.id, '', 'สัตว์เลี้ยงมีบ้านแล้ว');
    return res.json({ animal: publicAnimal(updated) });
  }

  return res.status(400).json({ error: 'คำสั่งไม่ถูกต้อง' });
}));

router.post('/animals', requireCustomer, wrap(async (req, res) => {
  const parsed = parseAnimalFields(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const primary = parsed.fields.photo || parsed.fields.photos?.[0];
  if (!primary || !isSupportedImageDataUrl(primary)) {
    return res.status(400).json({ error: 'รูปภาพต้องเป็น JPEG, PNG หรือ WebP และขนาดไม่เกิน 3 MB' });
  }

  const animal = await createAnimalRecord(req.customer.id, parsed.fields, {
    emoji: parsed.fields.species === 'แมว' ? '🐈' : '🐕',
  });

  return res.status(201).json({ animal: publicAnimal(animal, req.customer.id) });
}));

router.patch('/animals/:animalId', requireCustomer, wrap(async (req, res) => {
  const animal = await findAnimalById(req.params.animalId);
  if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });
  if (animal.ownerId !== req.customer.id) {
    return res.status(403).json({ error: 'แก้ไขได้เฉพาะโพสต์ที่คุณเป็นเจ้าของเท่านั้น' });
  }
  const editable = new Set([
    ANIMAL_STATUS.pending_review,
    ANIMAL_STATUS.published,
    ANIMAL_STATUS.has_interest,
    ANIMAL_STATUS.rejected,
  ]);
  if (!editable.has(animal.status)) {
    return res.status(409).json({ error: 'แก้ไขได้เฉพาะโพสต์ที่ยังเปิดหรือรอตรวจสอบ' });
  }

  const parsed = parseAnimalFields(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (parsed.fields.photo && !isSupportedImageDataUrl(parsed.fields.photo)) {
    return res.status(400).json({ error: 'รูปภาพต้องเป็น JPEG, PNG หรือ WebP และขนาดไม่เกิน 3 MB' });
  }

  const updated = await updateAnimalRecord(
    animal,
    {
      ...parsed.fields,
      location: parsed.fields.address,
      status: ANIMAL_STATUS.pending_review,
    },
    req.customer.id,
  );
  return res.json({ animal: publicAnimal(updated, req.customer.id) });
}));

router.post('/applications', wrap(async (req, res, next) => {
  try {
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
      address,
      experience,
      reason,
      hasOtherPets,
      careReadiness,
      additionalInfo,
    } = req.body ?? {};
    const customerSession = await getCustomerSession(req);
    const animal = await findAnimalById(animalId);

    if (!animal) {
      return res.status(404).json({ error: 'ไม่พบน้องที่เปิดรับบ้านอยู่' });
    }

    const useLegacyForm = typeof occupation === 'string';
    if (useLegacyForm) {
      if (
        typeof firstName !== 'string' ||
        !firstName.trim() ||
        typeof lastName !== 'string' ||
        !lastName.trim() ||
        !Number.isInteger(age) ||
        age < 1 ||
        typeof occupation !== 'string' ||
        !occupation.trim() ||
        typeof phone !== 'string' ||
        !phone.trim() ||
        !Number.isSafeInteger(salary) ||
        salary < 0 ||
        !['บ้าน', 'คอนโด', 'หอพัก'].includes(housingType) ||
        typeof hasCats !== 'boolean'
      ) {
        return res.status(400).json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก' });
      }
      if (homePhoto && !isSupportedImageDataUrl(homePhoto)) {
        return res.status(400).json({ error: 'รูปสภาพบ้านไม่ถูกต้อง' });
      }
      if (salaryStatementPhoto && !isSupportedImageDataUrl(salaryStatementPhoto)) {
        return res.status(400).json({ error: 'รูป Statement เงินเดือนไม่ถูกต้อง' });
      }
    } else {
      if (
        typeof firstName !== 'string' ||
        !firstName.trim() ||
        typeof phone !== 'string' ||
        !/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, '')) ||
        typeof address !== 'string' ||
        address.trim().length < 10 ||
        typeof reason !== 'string' ||
        reason.trim().length < 10
      ) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      }
    }

    if (!customerSession?.user?.id) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนส่งคำขอรับเลี้ยง' });
    }

    const application = await createApplicationRecord({
      animal,
      applicantUserId: customerSession.user.id,
      payload: {
        animalName: animal.name,
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        age,
        occupation: occupation?.trim(),
        phone: phone?.trim(),
        salary,
        salaryStatementPhoto,
        housingType,
        homePhoto,
        hasCats,
        catCount: hasCats ? catCount : null,
        address: address?.trim(),
        experience,
        reason: reason?.trim(),
        hasOtherPets,
        careReadiness,
        additionalInfo,
      },
    });

    return res.status(201).json({
      message: 'ส่งคำขอรับเลี้ยงเรียบร้อยแล้ว',
      application: {
        id: application.id,
        animalId: application.animalId,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
}));

router.get('/applications/mine', requireCustomer, wrap(async (req, res) => {
  const items = await listApplicationsForUser(req.customer.id);
  const animals = await Promise.all(items.map((item) => findAnimalById(item.animalId)));
  const nameById = new Map(animals.filter(Boolean).map((a) => [a.id, a.name]));
  res.json({
    applications: items.map((application) => ({
      id: application.id,
      animalId: application.animalId,
      animalName: nameById.get(application.animalId) || application.animalName || '',
      status: application.status,
      listingStatus: application.status,
      createdAt: application.createdAt,
      decidedAt: application.decidedAt || null,
      interviewAt: application.interviewAt || null,
    })),
  });
}));

router.post('/applications/:applicationId/cancel', requireCustomer, wrap(async (req, res) => {
  const application = await findApplicationById(req.params.applicationId);
  if (!application) return res.status(404).json({ error: 'ไม่พบคำขอรับเลี้ยง' });
  if (application.applicantUserId !== req.customer.id) {
    return res.status(403).json({ error: 'ยกเลิกได้เฉพาะคำขอของคุณเท่านั้น' });
  }
  if (!OPEN_APPLICATION_STATUSES.has(application.status)) {
    return res.status(409).json({ error: 'คำขอนี้ดำเนินการไปแล้ว ไม่สามารถยกเลิกได้' });
  }
  const updated = await setApplicationStatus(
    application,
    APPLICATION_STATUS.cancelled,
    req.customer.id,
  );
  return res.json({
    application: {
      id: updated.id,
      animalId: updated.animalId,
      status: updated.status,
      createdAt: updated.createdAt,
    },
  });
}));

router.get('/staff/applications', requireAdoptionStaff, wrap(async (_req, res) => {
  const applications = await listApplicationsForStaff();
  const enriched = await Promise.all(applications.map(async (application) => {
    const animal = await findAnimalById(application.animalId);
    return {
      id: application.id,
      animalId: application.animalId,
      animalName: animal?.name || application.animalName || '',
      firstName: application.firstName,
      lastName: application.lastName,
      status: application.status,
      createdAt: application.createdAt,
    };
  }));
  res.json({ applications: enriched });
}));

router.get('/staff/requests', requireAdoptionStaff, wrap(async (_req, res) => {
  const applications = await listApplicationsForStaff();
  const requests = await Promise.all(applications.map(async (application) => {
    const animal = await findAnimalById(application.animalId);
    return {
      id: application.id,
      animalId: application.animalId,
      animalName: animal?.name || application.animalName || '',
      firstName: application.firstName,
      lastName: application.lastName,
      status: application.status === APPLICATION_STATUS.submitted ? 'pending' : application.status,
      createdAt: application.createdAt,
    };
  }));
  res.json({ requests });
}));

router.get('/staff/requests/:requestId', requireAdoptionStaff, wrap(async (req, res) => {
  const application = await findApplicationById(req.params.requestId);
  if (!application) return res.status(404).json({ error: 'ไม่พบคำร้องขอรับเลี้ยง' });
  const animal = await findAnimalById(application.animalId);
  return res.json({
    request: { ...application, status: application.status === 'submitted' ? 'pending' : application.status },
    animal: animal ? publicAnimal(animal) : null,
  });
}));

router.patch('/staff/requests/:requestId', requireAdoptionStaff, wrap(async (req, res) => {
  const { status, note, interviewAt } = req.body ?? {};
  const application = await findApplicationById(req.params.requestId);
  if (!application) return res.status(404).json({ error: 'ไม่พบคำร้องขอรับเลี้ยง' });

  if (status === 'approved' || status === 'rejected') {
    if (!OPEN_APPLICATION_STATUSES.has(application.status) && application.status !== APPLICATION_STATUS.interview) {
      return res.status(409).json({ error: 'คำร้องนี้ได้รับการพิจารณาแล้ว' });
    }
    const animal = await findAnimalById(application.animalId);
    if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });
    if (status === 'approved' && animal.status !== ANIMAL_STATUS.published && animal.status !== ANIMAL_STATUS.has_interest) {
      return res.status(409).json({ error: 'สัตว์เลี้ยงมีบ้านแล้ว ไม่สามารถอนุมัติคำร้องนี้ได้' });
    }

    const nextStatus = status === 'approved' ? APPLICATION_STATUS.approved : APPLICATION_STATUS.rejected;
    const updated = await setApplicationStatus(application, nextStatus, 'adoption_staff', {
      resolutionNote: note,
    });

    let nextAnimal = animal;
    if (status === 'approved') {
      nextAnimal = await setAnimalStatus(animal, ANIMAL_STATUS.adopted, 'adoption_staff');
      await closeOtherApplications(animal.id, application.id, 'สัตว์เลี้ยงมีบ้านแล้ว');
    }

    return res.json({ request: updated, animal: publicAnimal(nextAnimal) });
  }

  if (status === 'reviewing' || status === 'interview') {
    const patch = { interviewAt: interviewAt || application.interviewAt };
    const updated = await setApplicationStatus(application, status, 'adoption_staff', patch);
    return res.json({ request: updated });
  }

  return res.status(400).json({ error: 'ผลการพิจารณาไม่ถูกต้อง' });
}));

router.patch('/staff/applications/:applicationId/status', requireAdoptionStaff, wrap(async (req, res) => {
  req.params.requestId = req.params.applicationId;
  const { status, note, interviewAt } = req.body ?? {};
  const application = await findApplicationById(req.params.applicationId);
  if (!application) return res.status(404).json({ error: 'ไม่พบคำร้องขอรับเลี้ยง' });

  if (status === 'approved' || status === 'rejected') {
    if (!OPEN_APPLICATION_STATUSES.has(application.status) && application.status !== APPLICATION_STATUS.interview) {
      return res.status(409).json({ error: 'คำร้องนี้ได้รับการพิจารณาแล้ว' });
    }
    const animal = await findAnimalById(application.animalId);
    if (!animal) return res.status(404).json({ error: 'ไม่พบข้อมูลสัตว์' });
    if (status === 'approved' && animal.status !== ANIMAL_STATUS.published && animal.status !== ANIMAL_STATUS.has_interest) {
      return res.status(409).json({ error: 'สัตว์เลี้ยงมีบ้านแล้ว ไม่สามารถอนุมัติคำร้องนี้ได้' });
    }

    const nextStatus = status === 'approved' ? APPLICATION_STATUS.approved : APPLICATION_STATUS.rejected;
    const updated = await setApplicationStatus(application, nextStatus, 'adoption_staff', {
      resolutionNote: note,
    });

    let nextAnimal = animal;
    if (status === 'approved') {
      nextAnimal = await setAnimalStatus(animal, ANIMAL_STATUS.adopted, 'adoption_staff');
      await closeOtherApplications(animal.id, application.id, 'สัตว์เลี้ยงมีบ้านแล้ว');
    }

    return res.json({ application: updated, animal: publicAnimal(nextAnimal) });
  }

  if (status === 'reviewing' || status === 'interview' || status === 'completed') {
    const patch = { interviewAt: interviewAt || application.interviewAt };
    const updated = await setApplicationStatus(application, status, 'adoption_staff', patch);
    return res.json({ application: updated });
  }

  return res.status(400).json({ error: 'สถานะคำขอไม่ถูกต้อง' });
}));

router.get('/staff/adoptions/history', requireAdoptionStaff, wrap(async (_req, res) => {
  const history = await adoptionHistory();
  res.json({
    items: history.map(({ animal, application }) => ({
      animal: publicAnimal(animal),
      adopterName: application
        ? [application.firstName, application.lastName].filter(Boolean).join(' ')
        : '',
      approvedAt: application?.decidedAt || animal.adoptedAt,
      completedAt: application?.completedAt || animal.adoptedAt,
    })),
  });
}));

router.get('/add-animal', (_req, res) => {
  res.json({ module: 'adoption', page: 'add-animal', status: 'placeholder' });
});

router.get('/requests', (_req, res) => {
  res.json({ module: 'adoption', page: 'requests', status: 'placeholder' });
});

export { ensureAdoptionReady };
export default router;