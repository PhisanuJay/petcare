import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADOPTION_API_URL } from '../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import './FindHome.css';

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด', icon: 'bi-grid' },
  { value: 'สุนัข', label: 'น้องหมา', icon: 'bi-house-heart' },
  { value: 'แมว', label: 'น้องแมว', icon: 'bi-emoji-smile' },
];
const PROVINCES = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี',
  'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด',
  'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี',
  'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี',
  'ปัตตานี', 'พะเยา', 'พระนครศรีอยุธยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี',
  'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา',
  'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ',
  'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี',
  'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู',
  'อ่างทอง', 'อุดรธานี', 'อุทัยธานี', 'อุตรดิตถ์', 'อุบลราชธานี', 'อำนาจเจริญ',
];

function getApiErrorMessage(error, fallback) {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'เชื่อมต่อ Backend ไม่ได้ กรุณาเปิดโฟลเดอร์ backend แล้วรัน npm run dev';
  }
  return error instanceof Error ? error.message : fallback;
}

function AnimalCard({ animal, onApply, onEdit }) {
  return (
    <article className="find-home-card">
      <div className="find-home-card-photo" style={{ background: animal.cardColor || '#e7f1ff' }}>
        {animal.photo ? (
          <img className="find-home-card-image" src={animal.photo} alt={`รูป${animal.name}`} />
        ) : (
          <span className="find-home-animal-emoji" aria-hidden="true">{animal.emoji}</span>
        )}
        <span className={`find-home-sex ${animal.sex}`}>
          <i className={`bi ${animal.sex === 'male' ? 'bi-gender-male' : 'bi-gender-female'}`} />
          {animal.sex === 'male' ? 'เพศผู้' : 'เพศเมีย'}
        </span>
      </div>
      <div className="find-home-card-body">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div>
            <h2>{animal.name}</h2>
            <p className="find-home-muted mb-0">
              {animal.breed ? `${animal.breed} · ` : ''}{animal.age}
            </p>
          </div>
          <span className="find-home-species">{animal.species}</span>
        </div>
        <p className="find-home-detail">
          <i className="bi bi-palette-fill" />
          สีขน: {animal.color}
        </p>
        <p className="find-home-detail">
          <i className="bi bi-shield-check" />
          วัคซีน: {animal.vaccination || animal.tags.join(', ')}
          {animal.vaccinationDetails ? ` (${animal.vaccinationDetails})` : ''}
        </p>
        <p className="find-home-detail">
          <i className="bi bi-heart-pulse" />
          โรคประจำตัว: {animal.disease || 'ไม่ระบุ'}
        </p>
        {animal.personality && (
          <p className="find-home-personality">
            <i className="bi bi-chat-heart-fill" />
            {animal.personality}
          </p>
        )}
        <p className="find-home-location">
          <i className="bi bi-geo-alt-fill" />
          จังหวัด: {animal.address || animal.location}
        </p>
        {animal.additionalInfo && (
          <p className="find-home-detail">
            <i className="bi bi-info-circle" />
            {animal.additionalInfo}
          </p>
        )}
        <div className="find-home-tags">
          {(animal.tags || []).map((tag) => (
            <span className="tag ok" key={tag}>
              <i className="bi bi-check2 me-1" />{tag}
            </span>
          ))}
        </div>
        {animal.isOwner ? (
          <button className="btn btn-soft w-100 mt-auto" type="button" onClick={() => onEdit(animal)}>
            <i className="bi bi-pencil-square me-2" />
            แก้ไขข้อมูล
          </button>
        ) : (
          <button className="btn btn-sky w-100 mt-auto" type="button" onClick={() => onApply(animal)}>
            <i className="bi bi-heart me-2" />
            สนใจรับเลี้ยง
          </button>
        )}
      </div>
    </article>
  );
}

function ApplicationDialog({ animal, onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [homePhoto, setHomePhoto] = useState('');
  const [salaryStatementPhoto, setSalaryStatementPhoto] = useState('');
  const [hasCats, setHasCats] = useState('');

  function handleHomePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setHomePhoto('');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('กรุณาเลือกรูปภาพ JPEG, PNG หรือ WebP');
      event.target.value = '';
      setHomePhoto('');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('ขนาดรูปสภาพบ้านต้องไม่เกิน 3 MB');
      event.target.value = '';
      setHomePhoto('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setHomePhoto(reader.result);
        setError('');
      } else {
        setError('อ่านรูปสภาพบ้านไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    };
    reader.onerror = () => setError('อ่านรูปสภาพบ้านไม่สำเร็จ กรุณาลองอีกครั้ง');
    reader.readAsDataURL(file);
  }

  function handleSalaryStatementChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setSalaryStatementPhoto('');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('กรุณาเลือกรูป Statement เป็น JPEG, PNG หรือ WebP');
      event.target.value = '';
      setSalaryStatementPhoto('');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('ขนาดรูป Statement ต้องไม่เกิน 3 MB');
      event.target.value = '';
      setSalaryStatementPhoto('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSalaryStatementPhoto(reader.result);
        setError('');
      } else {
        setError('อ่านรูป Statement ไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    };
    reader.onerror = () => setError('อ่านรูป Statement ไม่สำเร็จ กรุณาลองอีกครั้ง');
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`${ADOPTION_API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animalId: animal.id,
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          age: Number(formData.get('age')),
          occupation: formData.get('occupation'),
          phone: formData.get('phone'),
          salary: Number(formData.get('salary')),
          salaryStatementPhoto,
          housingType: formData.get('housingType'),
          homePhoto,
          hasCats: formData.get('hasCats') === 'yes',
          catCount: formData.get('hasCats') === 'yes'
            ? Number(formData.get('catCount'))
            : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
      setSent(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="find-home-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="find-home-modal application-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-title"
      >
        <button className="find-home-modal-close" type="button" aria-label="ปิด" onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
        {sent ? (
          <div className="find-home-success">
            <span className="find-home-success-icon"><i className="bi bi-heart-fill" /></span>
            <h2 id="application-title">ส่งคำขอเรียบร้อยแล้ว</h2>
            <p>ขอบคุณที่สนใจรับ {animal.name} ทีมงานจะติดต่อกลับตามข้อมูลที่ให้ไว้นะคะ</p>
            <button type="button" className="btn btn-sky" onClick={onClose}>เรียบร้อย</button>
          </div>
        ) : (
          <>
            <span className="chip">เริ่มต้นครอบครัวใหม่</span>
            <h2 id="application-title" className="mt-2">สนใจรับ {animal.name} ไปดูแล?</h2>
            <p className="find-home-muted">กรอกข้อมูลเพื่อให้ทีมงานพิจารณาความพร้อมในการรับเลี้ยง</p>
            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
            <form className="application-form" onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="applicant-first-name">ชื่อ</label>
                  <input className="form-control" id="applicant-first-name" name="firstName" autoComplete="given-name" maxLength="100" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="applicant-last-name">นามสกุล</label>
                  <input className="form-control" id="applicant-last-name" name="lastName" autoComplete="family-name" maxLength="100" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="applicant-age">อายุ (ปี)</label>
                  <input className="form-control" id="applicant-age" name="age" type="number" min="1" max="120" step="1" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="applicant-occupation">อาชีพ</label>
                  <input className="form-control" id="applicant-occupation" name="occupation" maxLength="100" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="applicant-phone">เบอร์โทรศัพท์</label>
                  <input className="form-control" id="applicant-phone" name="phone" type="tel" autoComplete="tel" maxLength="30" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="applicant-salary">เงินเดือน (บาท/เดือน)</label>
                  <input className="form-control" id="applicant-salary" name="salary" type="number" min="0" step="1" required />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="applicant-salary-statement">รูป Statement เงินเดือน</label>
                  <input
                    className="form-control"
                    id="applicant-salary-statement"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleSalaryStatementChange}
                    required
                  />
                  <div className="form-text mb-2">รองรับ JPEG, PNG หรือ WebP ขนาดไม่เกิน 3 MB</div>
                  {salaryStatementPhoto && (
                    <img
                      className="application-home-preview mb-2"
                      src={salaryStatementPhoto}
                      alt="ตัวอย่างรูป Statement เงินเดือน"
                    />
                  )}
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="applicant-housing">ประเภทที่พัก</label>
                  <select className="form-select" id="applicant-housing" name="housingType" required defaultValue="">
                    <option value="" disabled>เลือกประเภทที่พัก</option>
                    <option value="บ้าน">บ้าน</option>
                    <option value="คอนโด">คอนโด</option>
                    <option value="หอพัก">หอพัก</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="applicant-home-photo">รูปถ่ายสภาพบ้าน</label>
                  <input
                    className="form-control"
                    id="applicant-home-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleHomePhotoChange}
                    required
                  />
                  <div className="form-text mb-2">รองรับ JPEG, PNG หรือ WebP ขนาดไม่เกิน 3 MB</div>
                  {homePhoto && (
                    <img className="application-home-preview mb-2" src={homePhoto} alt="ตัวอย่างรูปสภาพบ้าน" />
                  )}
                </div>
                <fieldset className="col-12">
                  <legend className="form-label" id="cats-question">ที่บ้านมีแมวอยู่แล้วหรือไม่</legend>
                  <div className="find-home-vaccine-options">
                    <label className="find-home-vaccine-option">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="hasCats"
                        value="no"
                        checked={hasCats === 'no'}
                        onChange={(event) => setHasCats(event.target.value)}
                        required
                      />
                      <span>ไม่มี</span>
                    </label>
                    <label className="find-home-vaccine-option">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="hasCats"
                        value="yes"
                        checked={hasCats === 'yes'}
                        onChange={(event) => setHasCats(event.target.value)}
                        required
                      />
                      <span>มี</span>
                    </label>
                  </div>
                </fieldset>
                {hasCats === 'yes' && (
                  <div className="col-12">
                    <label className="form-label" htmlFor="applicant-cat-count">มีแมวกี่ตัว</label>
                    <input
                      className="form-control"
                      id="applicant-cat-count"
                      name="catCount"
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      required
                    />
                  </div>
                )}
                <div className="col-12">
                  <p className="form-text mb-0">ข้อมูลนี้ใช้ประกอบการพิจารณาคำขอรับเลี้ยงเท่านั้น</p>
                </div>
                <div className="col-12">
                  <button
                    className="btn btn-sky w-100"
                    type="submit"
                    disabled={submitting || !homePhoto || !salaryStatementPhoto}
                  >
                    {submitting ? 'กำลังส่งข้อมูล...' : 'ส่งคำขอรับเลี้ยง'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function AddAnimalDialog({ animal, authToken, onCreated, onClose }) {
  const isEditing = Boolean(animal);
  const [photo, setPhoto] = useState(animal?.photo || '');
  const [vaccination, setVaccination] = useState(animal?.vaccination || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhoto('');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('กรุณาเลือกรูปภาพ JPEG, PNG หรือ WebP');
      event.target.value = '';
      setPhoto('');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('ขนาดรูปภาพต้องไม่เกิน 3 MB');
      event.target.value = '';
      setPhoto('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhoto(reader.result);
        setError('');
      } else {
        setError('อ่านไฟล์รูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    };
    reader.onerror = () => setError('อ่านไฟล์รูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(
        isEditing
          ? `${ADOPTION_API_URL}/animals/${encodeURIComponent(animal.id)}`
          : `${ADOPTION_API_URL}/animals`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            name: formData.get('name'),
            species: formData.get('species'),
            sex: formData.get('sex'),
            age: formData.get('age'),
            color: formData.get('color'),
            vaccination: formData.get('vaccination'),
            vaccinationDetails: formData.get('vaccinationDetails') || '',
            disease: formData.get('disease'),
            address: formData.get('address'),
            additionalInfo: formData.get('additionalInfo'),
            photo,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
      onCreated(result.animal);
      setSaved(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="find-home-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="find-home-modal add-animal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-animal-title"
      >
        <button className="find-home-modal-close" type="button" aria-label="ปิด" onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
        {saved ? (
          <div className="find-home-success">
            <span className="find-home-success-icon"><i className="bi bi-check-lg" /></span>
            <h2 id="add-animal-title">{isEditing ? 'แก้ไขข้อมูลเรียบร้อยแล้ว' : 'เพิ่มข้อมูลเรียบร้อยแล้ว'}</h2>
            <p>{isEditing ? 'บันทึกข้อมูลสัตว์เลี้ยงแล้ว' : 'สัตว์เลี้ยงถูกเพิ่มในรายการหาบ้านแล้ว'}</p>
            <button type="button" className="btn btn-sky" onClick={onClose}>ดูรายการ</button>
          </div>
        ) : (
          <>
            <span className="chip">{isEditing ? 'แก้ไขโพสต์ของคุณ' : 'เพิ่มสมาชิกใหม่'}</span>
            <h2 id="add-animal-title" className="mt-2">
              {isEditing ? `แก้ไขข้อมูล${animal.name}` : 'เพิ่มสัตว์หาบ้าน'}
            </h2>
            <p className="find-home-muted">กรอกข้อมูลและรูปภาพเพื่อให้ผู้ที่สนใจทำความรู้จักน้อง</p>
            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
            <form className="add-animal-form" onSubmit={handleSubmit}>
              <label className="form-label" htmlFor="animal-photo">รูปภาพสัตว์</label>
              <input
                className="form-control mb-2"
                id="animal-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                required={!isEditing}
              />
              <div className="form-text mb-3">
                {isEditing ? 'เลือกภาพใหม่หากต้องการเปลี่ยนรูป ' : ''}
                รองรับ JPEG, PNG หรือ WebP ขนาดไม่เกิน 3 MB
              </div>
              {photo && <img className="add-animal-preview mb-3" src={photo} alt="ตัวอย่างรูปสัตว์" />}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="animal-name">ชื่อสัตว์</label>
                  <input className="form-control" id="animal-name" name="name" maxLength="100" defaultValue={animal?.name ?? ''} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="animal-species">ประเภทสัตว์</label>
                  <select className="form-select" id="animal-species" name="species" required defaultValue={animal?.species ?? ''}>
                    <option value="" disabled>เลือกประเภท</option>
                    <option value="สุนัข">สุนัข</option>
                    <option value="แมว">แมว</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="animal-sex">เพศ</label>
                  <select className="form-select" id="animal-sex" name="sex" required defaultValue={animal?.sex ?? ''}>
                    <option value="" disabled>เลือกเพศ</option>
                    <option value="male">เพศผู้</option>
                    <option value="female">เพศเมีย</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="animal-age">อายุ</label>
                  <input className="form-control" id="animal-age" name="age" placeholder="เช่น 1 ปี 2 เดือน" maxLength="50" defaultValue={animal?.age ?? ''} required />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="animal-color">สี</label>
                  <input className="form-control" id="animal-color" name="color" placeholder="เช่น ขาว-น้ำตาล" maxLength="100" defaultValue={animal?.color ?? ''} required />
                </div>
                <fieldset className="col-12">
                  <legend className="form-label">ข้อมูลวัคซีน</legend>
                  <div className="find-home-vaccine-options">
                    <label className="find-home-vaccine-option">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="vaccination"
                        value="ฉีดแล้ว"
                        checked={vaccination === 'ฉีดแล้ว'}
                        onChange={(event) => setVaccination(event.target.value)}
                        required
                      />
                      <span>ฉีดแล้ว</span>
                    </label>
                    {vaccination === 'ฉีดแล้ว' && (
                      <div className="find-home-vaccine-details">
                        <label className="form-label" htmlFor="animal-vaccination-details">
                          ฉีดครบหรือยัง หรือฉีดไปกี่เข็มแล้ว
                        </label>
                        <input
                          className="form-control"
                          id="animal-vaccination-details"
                          name="vaccinationDetails"
                          placeholder="เช่น ฉีดครบแล้ว หรือฉีดไปแล้ว 2 เข็ม"
                          maxLength="500"
                          defaultValue={animal?.vaccinationDetails ?? ''}
                          required
                        />
                      </div>
                    )}
                    <label className="find-home-vaccine-option">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="vaccination"
                        value="ยังไม่ได้ฉีด"
                        checked={vaccination === 'ยังไม่ได้ฉีด'}
                        onChange={(event) => setVaccination(event.target.value)}
                        required
                      />
                      <span>ยังไม่ได้ฉีด</span>
                    </label>
                  </div>
                </fieldset>
                <div className="col-12">
                  <label className="form-label" htmlFor="animal-disease">โรคประจำตัว</label>
                  <input className="form-control" id="animal-disease" name="disease" placeholder="ระบุโรค หรือพิมพ์ว่าไม่มี" maxLength="500" defaultValue={animal?.disease ?? ''} required />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="animal-address">จังหวัดที่อยู่</label>
                  <select className="form-select" id="animal-address" name="address" required defaultValue={animal?.address || animal?.location || ''}>
                    <option value="" disabled>เลือกจังหวัด</option>
                    {PROVINCES.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="animal-additional-info">ข้อมูลเพิ่มเติม</label>
                  <textarea className="form-control" id="animal-additional-info" name="additionalInfo" rows="2" maxLength="1000" defaultValue={animal?.additionalInfo ?? ''} />
                </div>
                <div className="col-12">
                  <button className="btn btn-sky w-100" type="submit" disabled={submitting || !photo}>
                    {submitting
                      ? (isEditing ? 'กำลังบันทึก...' : 'กำลังเพิ่มข้อมูล...')
                      : (isEditing ? 'บันทึกการแก้ไข' : 'เพิ่มสัตว์หาบ้าน')}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default function FindHomePage() {
  const { authToken } = useAuth();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [addingAnimal, setAddingAnimal] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState(null);

  async function loadAnimals(signal) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${ADOPTION_API_URL}/animals`, {
        signal,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดข้อมูลน้องๆ ไม่สำเร็จ');
      if (!Array.isArray(result.animals)) throw new Error('ข้อมูลน้องๆ จากระบบไม่ถูกต้อง');
      setAnimals(result.animals);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(getApiErrorMessage(requestError, 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่'));
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadAnimals(controller.signal);
    return () => controller.abort();
  }, [authToken]);

  function handleAddAnimal() {
    if (!authToken) {
      navigate('/login?next=%2Ffind-home');
      return;
    }
    setAddingAnimal(true);
  }

  const filteredAnimals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return animals.filter((animal) => {
      const matchesSpecies = species === 'all' || animal.species === species;
      const searchableText = [
        animal.name,
        animal.breed,
        animal.personality,
        animal.location,
        animal.address,
        animal.color,
      ].join(' ').toLocaleLowerCase('th');
      return matchesSpecies && searchableText.includes(normalizedQuery);
    });
  }, [animals, query, species]);

  return (
    <div className="find-home">
      <section className="find-home-hero">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <span className="chip"><i className="bi bi-house-heart me-1" /> หาบ้านให้น้อง</span>
              <h1>บ้านที่อบอุ่น<br /><span>เริ่มต้นจากการเจอกัน</span></h1>
              <p>ทำความรู้จักเพื่อนตัวน้อยที่กำลังรอครอบครัวใหม่ แล้วเปิดพื้นที่ในบ้านและหัวใจให้กัน</p>
              <a className="btn btn-sky" href="#available-animals">
                <i className="bi bi-search-heart me-2" />ค้นหาน้องๆ
              </a>
              <div className="find-home-hero-note">
                <i className="bi bi-shield-heart-fill" />
                ทุกการรับเลี้ยงมีทีมงานช่วยประสานและให้คำแนะนำ
              </div>
            </div>
            <div className="col-lg-5">
              <div className="find-home-hero-art" aria-label="ภาพประกอบสัตว์เลี้ยง">
                <span className="find-home-hero-sun" />
                <span className="find-home-hero-paw paw-one">🐾</span>
                <span className="find-home-hero-paw paw-two">🐾</span>
                <span className="find-home-hero-pet pet-dog">🐶</span>
                <span className="find-home-hero-pet pet-cat">🐱</span>
                <span className="find-home-hero-caption"><i className="bi bi-heart-fill" /> เพื่อนแท้กำลังรอคุณอยู่</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="available-animals" className="find-home-listing">
        <div className="container">
          <div className="find-home-listing-heading">
            <div>
              <span className="chip">สมาชิกใหม่ที่รอคุณ</span>
              <h2>เลือกเพื่อนตัวโปรด</h2>
              <p>ลองค้นหาจากชื่อ สายพันธุ์ หรือนิสัยที่ใช่สำหรับบ้านของคุณ</p>
            </div>
            <div className="find-home-listing-actions">
              <div className="find-home-search">
                <i className="bi bi-search" />
                <input
                  type="search"
                  className="form-control"
                  placeholder="ค้นหาน้องๆ..."
                  aria-label="ค้นหาน้องๆ"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-sky find-home-add-btn"
                onClick={handleAddAnimal}
              >
                <i className="bi bi-plus-lg me-2" />เพิ่มสัตว์หาบ้าน
              </button>
            </div>
          </div>

          <div className="find-home-filters" aria-label="กรองตามประเภทสัตว์">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`find-home-filter ${species === filter.value ? 'active' : ''}`}
                aria-pressed={species === filter.value}
                onClick={() => setSpecies(filter.value)}
              >
                <i className={`bi ${filter.icon}`} />{filter.label}
              </button>
            ))}
            {!loading && !error && (
              <span className="find-home-count">พบ {filteredAnimals.length} ชีวิต</span>
            )}
          </div>

          {loading && (
            <div className="find-home-state" role="status">
              <div className="spinner-border text-primary" aria-hidden="true" />
              <p>กำลังค้นหาเพื่อนตัวน้อย...</p>
            </div>
          )}
          {error && (
            <div className="find-home-state find-home-state-error" role="alert">
              <i className="bi bi-wifi-off" />
              <p>{error}</p>
              <button className="btn btn-soft" type="button" onClick={() => loadAnimals(new AbortController().signal)}>
                ลองอีกครั้ง
              </button>
            </div>
          )}
          {!loading && !error && filteredAnimals.length === 0 && (
            <div className="find-home-state">
              <i className="bi bi-search-heart" />
              <p>ยังไม่พบน้องที่ตรงกับการค้นหา ลองเปลี่ยนคำค้นดูนะ</p>
            </div>
          )}
          {!loading && !error && filteredAnimals.length > 0 && (
            <div className="row g-4">
              {filteredAnimals.map((animal) => (
                <div className="col-sm-6 col-lg-4 col-xl-3" key={animal.id}>
                  <AnimalCard
                    animal={animal}
                    onApply={setSelectedAnimal}
                    onEdit={setEditingAnimal}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="find-home-steps">
        <div className="container">
          <div className="title-wrap">
            <span className="chip">รับเลี้ยงอย่างเข้าใจ</span>
            <h2>4 ขั้นตอนสู่บ้านหลังใหม่</h2>
            <p className="mb-0">เราจะอยู่ข้างๆ ตั้งแต่วันที่เริ่มสนใจจนถึงวันที่น้องได้กลับบ้าน</p>
          </div>
          <div className="row g-3">
            {[
              ['bi-search-heart', 'เลือกน้องที่ใช่', 'ดูข้อมูลและนิสัยของน้องๆ'],
              ['bi-file-earmark-text', 'ส่งคำขอรับเลี้ยง', 'ฝากข้อมูลให้ทีมงานติดต่อกลับ'],
              ['bi-chat-heart', 'พูดคุยทำความรู้จัก', 'เตรียมบ้านและนัดพบกับน้อง'],
              ['bi-house-heart', 'ต้อนรับสมาชิกใหม่', 'รับคำแนะนำหลังน้องกลับบ้าน'],
            ].map(([icon, title, description], index) => (
              <div className="col-6 col-lg-3" key={title}>
                <div className="find-home-step">
                  <span className="find-home-step-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="find-home-step-icon"><i className={`bi ${icon}`} /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {selectedAnimal && (
        <ApplicationDialog animal={selectedAnimal} onClose={() => setSelectedAnimal(null)} />
      )}
      {addingAnimal && (
        <AddAnimalDialog
          authToken={authToken}
          onClose={() => setAddingAnimal(false)}
          onCreated={(animal) => setAnimals((current) => [animal, ...current])}
        />
      )}
      {editingAnimal && (
        <AddAnimalDialog
          key={editingAnimal.id}
          animal={editingAnimal}
          authToken={authToken}
          onClose={() => setEditingAnimal(null)}
          onCreated={(updatedAnimal) => {
            setAnimals((current) =>
              current.map((animal) => animal.id === updatedAnimal.id ? updatedAnimal : animal),
            );
          }}
        />
      )}
    </div>
  );
}
