import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { apiRequest, getApiBase } from '../api';

export default function AttendanceScannerPage() {
  const { eventId } = useParams();

  const [payload, setPayload] = useState('');
  const [manual, setManual] = useState({ ticketId: '', participantEmail: '', note: '' });
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadDashboard();
    return () => {
      stopCamera();
    };
  }, [eventId]);

  async function loadDashboard() {
    try {
      const response = await apiRequest(`/attendance/${eventId}/dashboard`);
      setDashboard(response);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleScan(rawPayload) {
    try {
      setMessage('');
      setError('');
      const response = await apiRequest('/attendance/scan', {
        method: 'POST',
        body: {
          eventId,
          qrPayload: rawPayload
        }
      });
      setMessage(`Attendance marked for ${response.participant.firstName || ''} ${response.participant.lastName || ''}`);
      setPayload('');
      await loadDashboard();
    } catch (err) {
      setError(err.message);
      await loadDashboard();
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;

    try {
      const imageData = await readImage(file);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (!result?.data) {
        setError('Could not read QR from image');
        return;
      }
      setPayload(result.data);
      await handleScan(result.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setError('Camera access denied or unavailable. Use file upload instead.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }

  async function captureAndScan() {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);

    if (!result?.data) {
      // Tried continuous scanning loop first, but manual capture reduced duplicate reads.
      setError('No QR found in camera frame');
      return;
    }

    setPayload(result.data);
    await handleScan(result.data);
  }

  async function submitManualOverride() {
    try {
      setError('');
      await apiRequest('/attendance/manual-override', {
        method: 'POST',
        body: {
          eventId,
          ticketId: manual.ticketId || undefined,
          participantEmail: manual.participantEmail || undefined,
          note: manual.note || 'Manual attendance override'
        }
      });
      setMessage('Manual override recorded.');
      setManual({ ticketId: '', participantEmail: '', note: '' });
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportCSV() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBase()}/attendance/${eventId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Failed to export attendance CSV');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>QR Scanner & Attendance Tracking</h2>
        {dashboard?.event?.name ? <p>Current Event: {dashboard.event.name}</p> : null}
        <p>Scan via raw payload, file upload, or camera capture.</p>

        <label>
          Scan Payload (for quick testing)
          <textarea value={payload} rows={3} onChange={(e) => setPayload(e.target.value)} />
        </label>

        <div className="forum-actions">
          <button type="button" className="btn" onClick={() => handleScan(payload)}>
            Mark Attendance
          </button>
          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e.target.files?.[0] || null)} />
        </div>

        <div className="camera-box">
          {!cameraOn ? (
            <button type="button" className="btn" onClick={startCamera}>
              Start Camera
            </button>
          ) : (
            <>
              <video ref={videoRef} className="video-preview" muted playsInline />
              <div className="forum-actions">
                <button type="button" className="btn" onClick={captureAndScan}>
                  Capture & Scan
                </button>
                <button type="button" className="btn" onClick={stopCamera}>
                  Stop Camera
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Manual Override (with audit log)</h3>
        <div className="grid-form">
          <label>
            Ticket ID
            <input value={manual.ticketId} onChange={(e) => setManual((prev) => ({ ...prev, ticketId: e.target.value }))} />
          </label>
          <label>
            Participant Email
            <input
              value={manual.participantEmail}
              onChange={(e) => setManual((prev) => ({ ...prev, participantEmail: e.target.value }))}
            />
          </label>
          <label className="full">
            Note
            <input value={manual.note} onChange={(e) => setManual((prev) => ({ ...prev, note: e.target.value }))} />
          </label>
        </div>

        <button type="button" className="btn" onClick={submitManualOverride}>
          Submit Override
        </button>
      </section>

      <section className="card">
        <h3>Live Attendance Dashboard</h3>
        {dashboard ? (
          <>
            <p>
              Total: {dashboard.summary.totalParticipants} | Scanned: {dashboard.summary.scanned} | Not Yet Scanned:{' '}
              {dashboard.summary.notScanned}
            </p>

            <div className="forum-actions">
              <button type="button" className="btn" onClick={loadDashboard}>
                Refresh
              </button>
              <button type="button" className="btn" onClick={exportCSV}>
                Export CSV
              </button>
            </div>

            <div className="dual-list">
              <div>
                <h4>Scanned</h4>
                <ul>
                  {(dashboard.scanned || []).map((row) => (
                    <li key={row.id}>
                      {row.name} ({row.email})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Not Yet Scanned</h4>
                <ul>
                  {(dashboard.notScanned || []).map((row) => (
                    <li key={row.id}>
                      {row.name} ({row.email})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p>Loading dashboard...</p>
        )}
      </section>

      {message ? <div className="info-box">{message}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
