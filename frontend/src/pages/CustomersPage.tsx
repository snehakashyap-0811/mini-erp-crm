import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';

type Customer = {
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
};

const emptyForm = {
  name: '',
  mobile: '',
  email: '',
  businessName: '',
  gstNumber: '',
  customerType: 'WHOLESALE',
  address: '',
  status: 'LEAD',
  followUpDate: '',
  notes: '',
};

export default function CustomersPage() {
  const user = getUser();
  const canEdit = user && ['ADMIN', 'SALES'].includes(user.role);
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await api<{ data: Customer[]; meta: { totalPages: number } }>(
        `/customers?${params}`
      );
      setItems(res.data);
      setTotalPages(res.meta.totalPages || 1);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    load();
  }, [page, status]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      businessName: c.businessName,
      gstNumber: c.gstNumber || '',
      customerType: c.customerType,
      address: c.address,
      status: c.status,
      followUpDate: c.followUpDate ? c.followUpDate.slice(0, 10) : '',
      notes: c.notes || '',
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        gstNumber: form.gstNumber || null,
        notes: form.notes || null,
        followUpDate: form.followUpDate
          ? new Date(form.followUpDate).toISOString()
          : null,
      };
      if (editing) {
        await api(`/customers/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/customers', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Customers</h1>
          <p>CRM directory, search, and follow-ups</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Add customer
          </button>
        )}
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search name, mobile, email, business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button className="btn" type="button" onClick={() => { setPage(1); load(); }}>
          Search
        </button>
      </div>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Business</th>
              <th>Type</th>
              <th>Mobile</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/customers/${c.id}`}>{c.name}</Link>
                  <div className="muted">{c.email}</div>
                </td>
                <td>{c.businessName}</td>
                <td>{c.customerType}</td>
                <td>{c.mobile}</td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </td>
                <td>{c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : '—'}</td>
                <td className="row-actions">
                  <Link to={`/customers/${c.id}`}>View</Link>
                  {canEdit && (
                    <button className="btn btn-ghost" type="button" onClick={() => openEdit(c)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            className="btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={onSubmit}>
            <h2>{editing ? 'Edit customer' : 'Add customer'}</h2>
            <div className="form-grid">
              {(
                [
                  ['name', 'Customer name'],
                  ['mobile', 'Mobile'],
                  ['email', 'Email'],
                  ['businessName', 'Business name'],
                  ['gstNumber', 'GST (optional)'],
                  ['address', 'Address'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={key !== 'gstNumber'}
                  />
                </label>
              ))}
              <label>
                Customer type
                <select
                  value={form.customerType}
                  onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                >
                  <option value="RETAIL">Retail</option>
                  <option value="WHOLESALE">Wholesale</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="LEAD">Lead</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <label>
                Follow-up date
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                />
              </label>
              <label className="full">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
