import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { email, token, newPassword }
      });
      setMessage(response.message || 'Password reset successful.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p>Enter the details from your reset email.</p>

        <form className="stack" onSubmit={onSubmit}>
          <label>
            Participant Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label>
            Reset Token
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
          </label>

          <label>
            New Password
            <input type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </label>

          <label>
            Confirm New Password
            <input type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>

          {message ? <div className="info-box">{message}</div> : null}
          {error ? <div className="error-box">{error}</div> : null}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Updating...' : 'Reset Password'}
          </button>
        </form>

        <p className="small-text">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
