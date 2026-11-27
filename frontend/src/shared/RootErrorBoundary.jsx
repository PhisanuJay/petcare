import { Component } from 'react';

export default class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('PetCare render error:', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: 'Prompt, Mitr, sans-serif',
            background: '#f4f9fd',
            color: '#17324d',
          }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.35rem', marginBottom: 8 }}>โหลดหน้าไม่สำเร็จ</h1>
            <p style={{ marginBottom: 16, opacity: 0.85 }}>{error.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}</p>
            <button
              type="button"
              className="btn btn-sky"
              onClick={() => window.location.reload()}
            >
              รีเฟรชหน้า
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}