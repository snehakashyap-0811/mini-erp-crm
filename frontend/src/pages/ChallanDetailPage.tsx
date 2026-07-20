import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';

type ChallanDetail = {
  id: string;
  challanNumber: string;
  status: string;
  totalQuantity: number;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    businessName: string;
    mobile: string;
    address: string;
  };
  createdBy: { name: string; email: string };
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    unitPrice: number | string;
    quantity: number;
  }>;
};

export default function ChallanDetailPage() {
  const { id } = useParams();
  const user = getUser();
  const canAct = user && ['ADMIN', 'SALES'].includes(user.role);
  const [challan, setChallan] = useState<ChallanDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api<{ data: ChallanDetail }>(`/challans/${id}`);
      setChallan(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function confirm() {
    setBusy(true);
    try {
      await api(`/challans/${id}/confirm`, { method: 'PATCH' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm('Cancel this challan? Confirmed stock will be restored.')) return;
    setBusy(true);
    try {
      await api(`/challans/${id}/cancel`, { method: 'PATCH' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !challan) return <div className="alert alert-error">{error}</div>;
  if (!challan) return <div className="muted">Loading…</div>;

  const totalValue = challan.items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/challans" className="back-link">
            ← Challans
          </Link>
          <h1>{challan.challanNumber}</h1>
          <p>
            Created by {challan.createdBy.name} · {new Date(challan.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`badge badge-${challan.status.toLowerCase()}`}>{challan.status}</span>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {canAct && challan.status === 'DRAFT' && (
        <div className="toolbar">
          <button className="btn btn-primary" disabled={busy} onClick={confirm}>
            Confirm (reduce stock)
          </button>
          <button className="btn" disabled={busy} onClick={cancel}>
            Cancel challan
          </button>
        </div>
      )}
      {canAct && challan.status === 'CONFIRMED' && (
        <div className="toolbar">
          <button className="btn" disabled={busy} onClick={cancel}>
            Cancel & restore stock
          </button>
        </div>
      )}

      <div className="detail-grid">
        <section className="panel">
          <h2>Customer</h2>
          <dl className="detail-list">
            <div>
              <dt>Business</dt>
              <dd>
                <Link to={`/customers/${challan.customer.id}`}>{challan.customer.businessName}</Link>
              </dd>
            </div>
            <div><dt>Contact</dt><dd>{challan.customer.name}</dd></div>
            <div><dt>Mobile</dt><dd>{challan.customer.mobile}</dd></div>
            <div><dt>Address</dt><dd>{challan.customer.address}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <h2>Summary</h2>
          <dl className="detail-list">
            <div><dt>Total quantity</dt><dd>{challan.totalQuantity}</dd></div>
            <div><dt>Line value</dt><dd>₹{totalValue.toLocaleString()}</dd></div>
            <div><dt>Status</dt><dd>{challan.status}</dd></div>
          </dl>
        </section>
      </div>

      <section className="panel">
        <h2>Product lines (snapshot)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Unit price</th>
              <th>Qty</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {challan.items.map((i) => (
              <tr key={i.id}>
                <td>{i.productName}</td>
                <td>{i.sku}</td>
                <td>₹{Number(i.unitPrice).toLocaleString()}</td>
                <td>{i.quantity}</td>
                <td>₹{(Number(i.unitPrice) * i.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
