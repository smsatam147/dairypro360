import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/endpoints';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(form);
      localStorage.setItem('dp360_token', data.token);
      localStorage.setItem('dp360_user', JSON.stringify(data.user));
      toast.success(`Welcome, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a3c5e 0%, #2e7d32 100%)'
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '2.5rem',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 48 }}>🥛</div>
          <h1 style={{ color: '#1a3c5e', margin: '0.5rem 0 0.25rem', fontSize: '1.8rem' }}>
            DairyPro 360
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
            All-in-One Dairy Management System
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: '0.9rem' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@dairypro.com"
              style={{
                width: '100%', padding: '0.75rem', border: '1.5px solid #ddd',
                borderRadius: 8, fontSize: '0.95rem', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333', fontSize: '0.9rem' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '0.75rem', border: '1.5px solid #ddd',
                borderRadius: 8, fontSize: '0.95rem', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.85rem', background: loading ? '#ccc' : '#1a3c5e',
              color: 'white', border: 'none', borderRadius: 8, fontSize: '1rem',
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#999', fontSize: '0.8rem' }}>
          DairyPro 360 v1.0 | Secure Login
        </p>
      </div>
    </div>
  );
}
