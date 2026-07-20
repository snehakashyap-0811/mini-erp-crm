import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { setSession, type User } from '../lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@erp.local');
  const [password, setPassword] = useState('Password@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ data: { token: string; user: User } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-head">
          <span className="brand-mark">ERP</span>
          <h1>Mini ERP + CRM</h1>
          <p>Wholesale operations portal</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="login-hint">
          <p>Demo users (password: <code>Password@123</code>)</p>
          <ul>
            <li>admin@erp.local</li>
            <li>sales@erp.local</li>
            <li>warehouse@erp.local</li>
            <li>accounts@erp.local</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
