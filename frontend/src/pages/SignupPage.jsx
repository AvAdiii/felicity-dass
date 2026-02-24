import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signupParticipant } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    participantType: 'IIIT',
    collegeName: 'IIIT Hyderabad',
    contactNumber: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateParticipantType(value) {
    setForm((prev) => {
      if (value === 'IIIT') {
        return {
          ...prev,
          participantType: value,
          collegeName: 'IIIT Hyderabad'
        };
      }

      return {
        ...prev,
        participantType: value,
        collegeName: prev.collegeName === 'IIIT Hyderabad' ? '' : prev.collegeName
      };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signupParticipant({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        participantType: form.participantType,
        collegeName: form.collegeName,
        contactNumber: form.contactNumber
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <h1>Participant Signup</h1>
        <p>Organizer accounts are created only by Admin.</p>

        <form onSubmit={onSubmit} className="grid-form">
          <label>
            First Name
            <input value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
          </label>

          <label>
            Last Name
            <input value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required />
          </label>

          <label>
            Participant Type
            <select value={form.participantType} onChange={(e) => updateParticipantType(e.target.value)}>
              <option value="IIIT">IIIT Student</option>
              <option value="NON_IIIT">Non-IIIT</option>
            </select>
          </label>

          <label>
            Email
            <input value={form.email} onChange={(e) => update('email', e.target.value)} type="email" required />
          </label>

          <label>
            Password
            <input
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              type="password"
              minLength={6}
              required
            />
          </label>

          <label>
            College / Organization
            <input
              value={form.collegeName}
              onChange={(e) => update('collegeName', e.target.value)}
              readOnly={form.participantType === 'IIIT'}
            />
          </label>

          <label>
            Contact Number
            <input
              value={form.contactNumber}
              onChange={(e) => update('contactNumber', e.target.value)}
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              title="Enter a 10-digit number"
              required
            />
          </label>

          {error ? <div className="error-box full">{error}</div> : null}

          <button className="btn full" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="small-text">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
