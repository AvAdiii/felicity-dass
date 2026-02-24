import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { organizer_category_options } from '../constants/categories';

export default function ManageOrganizersPage() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    organizerName: '',
    category: organizer_category_options[0],
    description: '',
    contactEmail: '',
    contactNumber: ''
  });
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const response = await apiRequest('/admin/organizers');
      setList(response.organizers || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createOrganizer() {
    try {
      setError('');
      const response = await apiRequest('/admin/organizers', {
        method: 'POST',
        body: form
      });
      setGenerated(response.credentials);
      setForm({
        organizerName: '',
        category: organizer_category_options[0],
        description: '',
        contactEmail: '',
        contactNumber: ''
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function takeAction(id, action) {
    try {
      await apiRequest(`/admin/organizers/${id}`, {
        method: 'PATCH',
        body: { action }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Manage Clubs / Organizers</h2>

        <div className="grid-form">
          <label>
            Organizer Name
            <input value={form.organizerName} onChange={(e) => setForm((p) => ({ ...p, organizerName: e.target.value }))} />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
              {organizer_category_options.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Description
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
          </label>
          <label>
            Contact Email
            <input value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
          </label>
          <label>
            Contact Number
            <input
              value={form.contactNumber}
              onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              title="Enter a 10-digit number"
            />
          </label>
        </div>

        <button type="button" className="btn" onClick={createOrganizer}>
          Add New Organizer
        </button>

        {generated ? (
          <div className="info-box">
            Generated login credentials: <strong>{generated.email}</strong> / <strong>{generated.password}</strong>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h3>Organizer Accounts</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Login Email</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((org) => (
                <tr key={org._id}>
                  <td>{org.organizerName}</td>
                  <td>{org.email}</td>
                  <td>
                    {org.disabled ? 'Disabled' : 'Active'} / {org.archived ? 'Archived' : 'Live'}
                  </td>
                  <td>
                    <div className="forum-actions">
                      <button type="button" className="chip" onClick={() => takeAction(org._id, 'disable')}>
                        Disable
                      </button>
                      <button type="button" className="chip" onClick={() => takeAction(org._id, 'enable')}>
                        Enable
                      </button>
                      <button type="button" className="chip" onClick={() => takeAction(org._id, 'archive')}>
                        Archive
                      </button>
                      <button type="button" className="chip" onClick={() => takeAction(org._id, 'delete')}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length ? (
                <tr>
                  <td colSpan={4}>No organizers yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
