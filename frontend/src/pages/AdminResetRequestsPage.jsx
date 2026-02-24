import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function AdminResetRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [comment, setComment] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    try {
      const response = await apiRequest(`/admin/password-reset-requests?status=${statusFilter}`);
      setRequests(response.requests || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRequest(id, action) {
    try {
      setGeneratedPassword('');
      const response = await apiRequest(`/admin/password-reset-requests/${id}`, {
        method: 'PATCH',
        body: {
          action,
          comment
        }
      });

      if (response.generatedPassword) {
        setGeneratedPassword(`Generated password: ${response.generatedPassword}`);
      }

      setComment('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Password Reset Requests</h2>

        <div className="forum-actions">
          <label>
            Status Filter
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>

          <label>
            Admin comment (used for approve/reject click)
            <input value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organizer</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Comment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length ? (
                requests.map((req) => (
                  <tr key={req._id}>
                    <td>{req.organizer?.organizerName}</td>
                    <td>{new Date(req.createdAt).toLocaleString()}</td>
                    <td>{req.reason}</td>
                    <td>{req.status}</td>
                    <td>{req.adminComment || '-'}</td>
                    <td>
                      {req.status === 'PENDING' ? (
                        <div className="forum-actions">
                          <button type="button" className="chip" onClick={() => handleRequest(req._id, 'approve')}>
                            Approve
                          </button>
                          <button type="button" className="chip" onClick={() => handleRequest(req._id, 'reject')}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No requests in this status.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {generatedPassword ? <div className="info-box">{generatedPassword}</div> : null}
      </section>

      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
