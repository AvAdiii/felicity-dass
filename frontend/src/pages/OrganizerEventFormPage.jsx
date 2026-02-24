import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../api';

function blankField(order = 0) {
  return {
    fieldId: `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    label: '',
    type: 'text',
    required: false,
    optionsText: '',
    order
  };
}

function blankItem() {
  return {
    rowId: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    sku: '',
    name: '',
    size: '',
    color: '',
    variant: '',
    price: '',
    stock: '',
    purchaseLimit: '1'
  };
}

const eligibility_options = ['OPEN', 'IIIT', 'NON_IIIT'];

function validate_timeline(registration_deadline, start_date, end_date) {
  const reg = new Date(registration_deadline);
  const start = new Date(start_date);
  const end = new Date(end_date);

  if (Number.isNaN(reg.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Please enter valid registration, start, and end date-times.';
  }

  if (!(reg < start)) {
    return 'Registration deadline must be earlier than event start time.';
  }

  if (!(start < end)) {
    return 'Event start time must be earlier than event end time.';
  }

  return '';
}

export default function OrganizerEventFormPage({ mode }) {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'NORMAL',
    eligibility: 'OPEN',
    registrationDeadline: '',
    startDate: '',
    endDate: '',
    registrationLimit: 100,
    registrationFee: 0,
    teamBased: false,
    maxTeamSize: 2,
    tagsText: '',
    status: 'DRAFT',
    customForm: [blankField(0)],
    merchandiseItems: [blankItem()],
    formLocked: false
  });

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');

  useEffect(() => {
    let ignore = false;
    if (mode !== 'edit') return undefined;

    async function load() {
      setLoading(true);
      try {
        const response = await apiRequest(`/organizers/me/events/${eventId}`);
        if (ignore) return;
        const event = response.event;
        const normalized_items = event.merchandise?.items?.length
          ? event.merchandise.items.map((item) => ({
              rowId: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              sku: item.sku || '',
              name: item.name || '',
              size: item.size || '',
              color: item.color || '',
              variant: item.variant || '',
              price: String(item.price ?? ''),
              stock: String(item.stock ?? ''),
              purchaseLimit: String(item.purchaseLimit ?? 1)
            }))
          : [blankItem()];
        setForm({
          name: event.name || '',
          description: event.description || '',
          type: event.type || 'NORMAL',
          eligibility: event.eligibility?.[0] || 'OPEN',
          registrationDeadline: event.registrationDeadline?.slice(0, 16) || '',
          startDate: event.startDate?.slice(0, 16) || '',
          endDate: event.endDate?.slice(0, 16) || '',
          registrationLimit: event.registrationLimit || 100,
          registrationFee: event.registrationFee || 0,
          teamBased: Boolean(event.teamBased),
          maxTeamSize: Number(event.maxTeamSize || 2),
          tagsText: (event.tags || []).join(','),
          status: event.status || 'DRAFT',
          customForm: (event.customForm || []).map((field, idx) => ({
            ...field,
            optionsText: (field.options || []).join(','),
            order: field.order ?? idx
          })),
          merchandiseItems: normalized_items,
          formLocked: event.formLocked
        });
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [mode, eventId]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEventType(nextType) {
    setForm((prev) => ({
      ...prev,
      type: nextType,
      teamBased: nextType === 'NORMAL' ? prev.teamBased : false,
      maxTeamSize: nextType === 'NORMAL' ? prev.maxTeamSize : 1
    }));
  }

  function updateCustomField(index, key, value) {
    setForm((prev) => ({
      ...prev,
      customForm: prev.customForm.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    }));
  }

  function addField() {
    setForm((prev) => ({
      ...prev,
      customForm: [...prev.customForm, blankField(prev.customForm.length)]
    }));
  }

  function moveField(index, direction) {
    setForm((prev) => {
      const next = [...prev.customForm];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      // Kept this simple swap-based reorder for now instead of full drag-drop.
      [next[index], next[target]] = [next[target], next[index]];
      return {
        ...prev,
        customForm: next.map((item, idx) => ({ ...item, order: idx }))
      };
    });
  }

  function removeField(index) {
    setForm((prev) => ({
      ...prev,
      customForm: prev.customForm.filter((_, i) => i !== index).map((item, idx) => ({ ...item, order: idx }))
    }));
  }

  function updateItem(index, key, value) {
    setForm((prev) => ({
      ...prev,
      merchandiseItems: prev.merchandiseItems.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    }));
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      merchandiseItems: [...prev.merchandiseItems, blankItem()]
    }));
  }

  function removeItem(index) {
    setForm((prev) => ({
      ...prev,
      merchandiseItems: prev.merchandiseItems.filter((_, i) => i !== index)
    }));
  }

  function buildPayload(nextStatus = form.status) {
    if (mode === 'edit' && form.status === 'PUBLISHED') {
      const payload = {
        description: form.description,
        registrationDeadline: form.registrationDeadline,
        registrationLimit: Number(form.registrationLimit),
        status: nextStatus
      };
      if (nextStatus === 'CLOSED') {
        payload.action = 'close_registrations';
      }
      return payload;
    }

    if (mode === 'edit' && ['ONGOING', 'COMPLETED', 'CLOSED'].includes(form.status)) {
      return { status: nextStatus };
    }

    const payload_merchandise_items = form.type === 'MERCHANDISE'
      ? form.merchandiseItems.map((item) => ({
          sku: String(item.sku || '').trim(),
          name: String(item.name || '').trim(),
          size: String(item.size || '').trim(),
          color: String(item.color || '').trim(),
          variant: String(item.variant || '').trim(),
          price: Number(item.price || 0),
          stock: Number(item.stock || 0),
          purchaseLimit: Number(item.purchaseLimit || 1)
        }))
      : [];

    return {
      name: form.name,
      description: form.description,
      type: form.type,
      eligibility: form.eligibility ? [form.eligibility] : [],
      registrationDeadline: form.registrationDeadline,
      startDate: form.startDate,
      endDate: form.endDate,
      registrationLimit: Number(form.registrationLimit),
      registrationFee: Number(form.registrationFee),
      teamBased: form.type === 'NORMAL' ? Boolean(form.teamBased) : false,
      maxTeamSize: form.type === 'NORMAL' && form.teamBased ? Number(form.maxTeamSize || 2) : 1,
      tags: form.tagsText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      status: nextStatus,
      customForm: form.type === 'NORMAL'
        ? form.customForm.map((field, idx) => ({
            fieldId: field.fieldId,
            label: field.label,
            type: field.type,
            required: Boolean(field.required),
            options: field.optionsText
              ? field.optionsText
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean)
              : [],
            order: idx
          }))
        : [],
      merchandise: {
        items: payload_merchandise_items
      }
    };
  }

  async function submit(nextStatus = form.status) {
    setError('');
    setMessage('');

    const timeline_error = validate_timeline(form.registrationDeadline, form.startDate, form.endDate);
    if (timeline_error) {
      setError(timeline_error);
      return;
    }

    if (form.type === 'NORMAL' && form.teamBased && Number(form.maxTeamSize) < 2) {
      setError('For team-based events, max participants per team must be at least 2.');
      return;
    }

    try {
      const payload = buildPayload(nextStatus);
      if (mode === 'create') {
        const response = await apiRequest('/organizers/me/events', {
          method: 'POST',
          body: payload
        });
        setMessage('Event created.');
        navigate(`/organizer/events/${response.event._id}`);
      } else {
        await apiRequest(`/organizers/me/events/${eventId}`, {
          method: 'PATCH',
          body: payload
        });
        setMessage('Event updated.');
        setForm((prev) => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="card">Loading event editor...</div>;

  const isDraftEditable = mode === 'create' || form.status === 'DRAFT';
  const isPublishedEditable = mode === 'edit' && form.status === 'PUBLISHED';
  const isStatusOnlyEditable = mode === 'edit' && ['ONGOING', 'COMPLETED', 'CLOSED'].includes(form.status);

  const canEditDescription = isDraftEditable || isPublishedEditable;
  const canEditDeadline = isDraftEditable || isPublishedEditable;
  const canEditRegistrationLimit = isDraftEditable || isPublishedEditable;
  const canEditEverything = isDraftEditable;

  return (
    <div className="stack">
      <section className="card">
        <h2>{mode === 'create' ? 'Create Event' : 'Edit Event'}</h2>
        <p>Flow: Draft -&gt; publish. Published editing rules are enforced by backend.</p>
        {isPublishedEditable ? (
          <div className="warn-box">
            Published mode: only description, registration deadline (extend only), and registration limit (increase only) can be edited.
          </div>
        ) : null}
        {isStatusOnlyEditable ? (
          <div className="warn-box">This status allows only status changes (close/completed). Other fields are read-only.</div>
        ) : null}

        <div className="grid-form">
          <label>
            Event Name
            <input value={form.name} onChange={(e) => update('name', e.target.value)} disabled={!canEditEverything} />
          </label>

          <label>
            Event Type
            <select value={form.type} onChange={(e) => updateEventType(e.target.value)} disabled={!canEditEverything}>
              <option value="NORMAL">NORMAL</option>
              <option value="MERCHANDISE">MERCHANDISE</option>
            </select>
          </label>

          <label className="full">
            Description
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} disabled={!canEditDescription} />
          </label>

          <label>
            Eligibility
            <select value={form.eligibility} onChange={(e) => update('eligibility', e.target.value)} disabled={!canEditEverything}>
              {eligibility_options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tags (comma separated)
            <input value={form.tagsText} onChange={(e) => update('tagsText', e.target.value)} disabled={!canEditEverything} />
          </label>

          <label>
            Registration Deadline
            <input
              type="datetime-local"
              value={form.registrationDeadline}
              onChange={(e) => update('registrationDeadline', e.target.value)}
              disabled={!canEditDeadline}
            />
          </label>

          <label>
            Event Start
            <input type="datetime-local" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} disabled={!canEditEverything} />
          </label>

          <label>
            Event End
            <input type="datetime-local" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} disabled={!canEditEverything} />
          </label>

          <label>
            Registration Limit
            <input
              type="number"
              min={1}
              value={form.registrationLimit}
              onChange={(e) => update('registrationLimit', e.target.value)}
              disabled={!canEditRegistrationLimit}
            />
          </label>

          <label>
            Registration Fee
            <input
              type="number"
              min={0}
              value={form.registrationFee}
              onChange={(e) => update('registrationFee', e.target.value)}
              disabled={!canEditEverything}
            />
          </label>

          {form.type === 'NORMAL' ? (
            <label>
              Team Based Participation
              <select
                value={form.teamBased ? 'YES' : 'NO'}
                onChange={(e) => update('teamBased', e.target.value === 'YES')}
                disabled={!canEditEverything}
              >
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </label>
          ) : null}

          {form.type === 'NORMAL' && form.teamBased ? (
            <label>
              Max Participants Per Team
              <input
                type="number"
                min={2}
                value={form.maxTeamSize}
                onChange={(e) => update('maxTeamSize', e.target.value)}
                disabled={!canEditEverything}
              />
            </label>
          ) : null}
        </div>
      </section>

      {form.type === 'NORMAL' ? (
        <section className="card">
          <h3>Custom Registration Form Builder</h3>
          {form.formLocked ? <div className="warn-box">Form locked after first registration.</div> : null}

          {form.customForm.map((field, index) => (
            <div key={field.fieldId} className="field-row">
              <input
                placeholder="Label"
                value={field.label}
                onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                disabled={form.formLocked || !canEditEverything}
              />
              <select
                value={field.type}
                onChange={(e) => updateCustomField(index, 'type', e.target.value)}
                disabled={form.formLocked || !canEditEverything}
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
                <option value="dropdown">Dropdown</option>
                <option value="checkbox">Checkbox</option>
                <option value="file">File</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
              </select>
              <input
                placeholder="Options (comma separated)"
                value={field.optionsText || ''}
                onChange={(e) => updateCustomField(index, 'optionsText', e.target.value)}
                disabled={form.formLocked || !canEditEverything || !['dropdown', 'checkbox'].includes(field.type)}
              />
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={Boolean(field.required)}
                  onChange={(e) => updateCustomField(index, 'required', e.target.checked)}
                  disabled={form.formLocked || !canEditEverything}
                />
                Required
              </label>
              <button
                type="button"
                className="chip"
                onClick={() => moveField(index, 'up')}
                disabled={form.formLocked || !canEditEverything}
              >
                ↑
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => moveField(index, 'down')}
                disabled={form.formLocked || !canEditEverything}
              >
                ↓
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => removeField(index)}
                disabled={form.formLocked || !canEditEverything}
              >
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="btn" onClick={addField} disabled={form.formLocked || !canEditEverything}>
            Add Field
          </button>
        </section>
      ) : (
        <section className="card">
          <h3>Merchandise Items</h3>
          {form.merchandiseItems.map((item, index) => (
            <div key={item.rowId || `item-${index}`} className="grid-form bordered">
              <label>
                SKU
                <input value={item.sku} onChange={(e) => updateItem(index, 'sku', e.target.value)} disabled={!canEditEverything} />
              </label>
              <label>
                Name
                <input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} disabled={!canEditEverything} />
              </label>
              <label>
                Variant
                <input value={item.variant} onChange={(e) => updateItem(index, 'variant', e.target.value)} disabled={!canEditEverything} />
              </label>
              <label>
                Size
                <input value={item.size} onChange={(e) => updateItem(index, 'size', e.target.value)} disabled={!canEditEverything} />
              </label>
              <label>
                Color
                <input value={item.color} onChange={(e) => updateItem(index, 'color', e.target.value)} disabled={!canEditEverything} />
              </label>
              <label>
                Price
                <input
                  type="number"
                  min={0}
                  value={item.price}
                  onChange={(e) => updateItem(index, 'price', e.target.value)}
                  disabled={!canEditEverything}
                />
              </label>
              <label>
                Stock
                <input
                  type="number"
                  min={0}
                  value={item.stock}
                  onChange={(e) => updateItem(index, 'stock', e.target.value)}
                  disabled={!canEditEverything}
                />
              </label>
              <label>
                Purchase Limit
                <input
                  type="number"
                  min={1}
                  value={item.purchaseLimit}
                  onChange={(e) => updateItem(index, 'purchaseLimit', e.target.value)}
                  disabled={!canEditEverything}
                />
              </label>
              <button type="button" className="chip" onClick={() => removeItem(index)} disabled={!canEditEverything}>
                Remove Item
              </button>
            </div>
          ))}

          <button type="button" className="btn" onClick={addItem} disabled={!canEditEverything}>
            Add Item
          </button>
        </section>
      )}

      <section className="card">
        <h3>Actions</h3>
        <div className="forum-actions">
          {isDraftEditable ? (
            <>
              <button type="button" className="btn" onClick={() => submit('DRAFT')}>
                Save as Draft
              </button>
              <button type="button" className="btn" onClick={() => submit('PUBLISHED')}>
                Publish
              </button>
            </>
          ) : null}

          {isPublishedEditable ? (
            <>
              <button type="button" className="btn" onClick={() => submit('PUBLISHED')}>
                Save Published Changes
              </button>
              <button type="button" className="btn" onClick={() => submit('ONGOING')}>
                Mark Ongoing
              </button>
              <button type="button" className="btn" onClick={() => submit('CLOSED')}>
                Close Registrations
              </button>
            </>
          ) : null}

          {isStatusOnlyEditable ? (
            <>
              <button type="button" className="btn" onClick={() => submit('CLOSED')}>
                Mark Closed
              </button>
              <button type="button" className="btn" onClick={() => submit('COMPLETED')}>
                Mark Completed
              </button>
            </>
          ) : null}
        </div>

        {message ? <p className="info-box">{message}</p> : null}
        {error ? <p className="error-box">{error}</p> : null}
      </section>
    </div>
  );
}
