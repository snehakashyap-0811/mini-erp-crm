import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type DashboardData = {
  totals: {
    customers: number;
    products: number;
    lowStock: number;
    draftChallans: number;
    confirmedChallans: number;
  };
  recentChallans: Array<{
    id: string;
    challanNumber: string;
    status: string;
    totalQuantity: number;
    createdAt: string;
    customer: { name: string; businessName: string };
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ data: DashboardData }>('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="muted">Loading dashboard…</div>;

  const cards = [
    { label: 'Customers', value: data.totals.customers },
    { label: 'Products', value: data.totals.products },
    { label: 'Low stock', value: data.totals.lowStock },
    { label: 'Draft challans', value: data.totals.draftChallans },
    { label: 'Confirmed challans', value: data.totals.confirmedChallans },
  ];

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Operations overview for wholesale / distribution</p>
        </div>
      </header>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <span>{c.label}</span>
            <strong>{c.value}</strong>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent challans</h2>
          <Link to="/challans">View all</Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.recentChallans.map((c) => (
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
                <td>{new Date(c.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {data.recentChallans.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No challans yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
