import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';

type Challan = {
  id: string;
  challanNumber: string;
  status: string;
  totalQuantity: number;
  createdAt: string;
  customer: { name: string; businessName: string };
  createdBy: { name: string };
};

export default function ChallansPage() {
  const user = getUser();
  const canCreate = user && ['ADMIN', 'SALES'].includes(user.role);
  const [items, setItems] = useState<Challan[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  async function load() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await api<{ data: Challan[]; meta: { totalPages: number } }>(
        `/challans?${params}`
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

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Sales Challans</h1>
          <p>Create drafts, confirm deliveries, and track stock impact</p>
        </div>
        {canCreate && (
          <Link className="btn btn-primary" to="/challans/new">
            New challan
          </Link>
        )}
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search challan or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button className="btn" type="button" onClick={() => { setPage(1); load(); }}>
          Search
        </button>
      </div>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Challan</th>
              <th>Customer</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/challans/${c.id}`}>{c.challanNumber}</Link>
                </td>
                <td>
                  {c.customer.businessName}
                  <div className="muted">{c.customer.name}</div>
                </td>
                <td>{c.totalQuantity}</td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </td>
                <td>{c.createdBy.name}</td>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
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
    </div>
  );
}
