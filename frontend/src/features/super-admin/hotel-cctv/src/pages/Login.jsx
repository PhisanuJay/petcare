import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CatMark } from '../components/Marks';

export default function Login() {
  const navigate = useNavigate();
  const [hotelName, setHotelName] = useState('Pet Hotel');
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/auth/brand').then((data) => setHotelName(data.hotelName)).catch(() => {});
    api('/api/auth/me')
      .then((data) => navigate(data.user.role === 'customer' ? '/watch' : '/admin', { replace: true }))
      .catch(() => {});
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
      navigate(data.user.role === 'customer' ? '/watch' : '/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="brand-mark"><CatMark /></span>
          <div>
            <strong>Pet Hotel</strong>
            <small>{hotelName}</small>
          </div>
        </div>
        <h1>เข้าสู่ระบบ</h1>
        <p className="muted">ชื่อผู้ใช้ Admin รหัสผ่าน 1234</p>
        {error ? <p className="banner error">{error}</p> : null}
        <label>
          ชื่อผู้ใช้
          <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label>
          รหัสผ่าน
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="button wide" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบ'}</button>
      </form>
    </main>
  );
}
