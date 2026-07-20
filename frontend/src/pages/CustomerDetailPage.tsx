import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';

type FollowUp = {
  id: string;
  note: string;
  createdAt: string;
  createdBy: { name: string };
};

type CustomerDetail = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber?: string | null;
  customerType: string;
  address: string;
  status: string;
  followUpDate?: string | null;
  notes?: string | null;
  followUps: FollowUp[];
  challans: Array<{
    id: string;
    challanNumber: string;
    status: string;
    totalQuantity: number;
    createdAt: string;
  }>;
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const user = getUser();
  const canEdit = user && ['ADMIN', 'SALES'].includes(user.role);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await api<{ data: CustomerDetail }>(`/customers/${id}`);
      setCustomer(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addFollowUp(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/customers/${id}/follow-ups`, {
        method: 'POST',
        body: JSON.stringify({
          note,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
        }),
      });
      setNote('');
      setFollowUpDate('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }

  if (error && !customer) return <div className="alert alert-error">{error}</div>;
  if (!customer) return <div className="muted">Loading…</div>;

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/customers" className="back-link">
            ← Customers
          </Link>
          <h1>{customer.name}</h1>
          <p>{customer.businessName}</p>
        </div>
        <span className={`badge badge-${customer.status.toLowerCase()}`}>{customer.status}</span>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="detail-grid">
        <section className="panel">
          <h2>Profile</h2>
          <dl className="detail-list">
            <div><dt>Mobile</dt><dd>{customer.mobile}</dd></div>
            <div><dt>Email</dt><dd>{customer.email}</dd></div>
            <div><dt>Type</dt><dd>{customer.customerType}</dd></div>
            <div><dt>GST</dt><dd>{customer.gstNumber || '—'}</dd></div>
            <div><dt>Address</dt><dd>{customer.address}</dd></div>
            <div>
              <dt>Follow-up</dt>
              <dd>
                {customer.followUpDate
                  ? new Date(customer.followUpDate).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div><dt>Notes</dt><dd>{customer.notes || '—'}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <h2>Follow-up notes</h2>
          {canEdit && (
            <form className="stack-form" onSubmit={addFollowUp}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add follow-up note…"
                required
                rows={3}
              />
              <label>
                Next follow-up date
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </label>
              <button className="btn btn-primary" disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Add note'}
              </button>
            </form>
          )}
          <ul className="timeline">
            {customer.followUps.map((f) => (
              <li key={f.id}>
                <strong>{f.createdBy.name}</strong>
                <span className="muted">{new Date(f.createdAt).toLocaleString()}</span>
                <p>{f.note}</p>
              </li>
            ))}
            {customer.followUps.length === 0 && <li className="muted">No follow-ups yet</li>}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>Recent challans</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {customer.challans.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/challans/${c.id}`}>{c.challanNumber}</Link>
                </td>
                <td>{c.totalQuantity}</td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </td>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {customer.challans.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No challans for this customer
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
