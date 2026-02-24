import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email }
      });
      setMessage(response.message || 'If the account exists, reset instructions have been sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p>Participant accounts can reset password via email. Organizer resets are handled by admin.</p>

        <form className="stack" onSubmit={onSubmit}>
          <label>
            Participant Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          {message ? <div className="info-box">{message}</div> : null}
          {error ? <div className="error-box">{error}</div> : null}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="small-text">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
