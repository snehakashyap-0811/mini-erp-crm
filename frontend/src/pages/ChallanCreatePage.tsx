import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type Customer = { id: string; name: string; businessName: string };
type Product = { id: string; name: string; sku: string; currentStock: number; unitPrice: number | string };

type Line = { productId: string; quantity: number };

export default function ChallanCreatePage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: 1 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ data: Customer[] }>('/customers?limit=50'),
      api<{ data: Product[] }>('/products?limit=50'),
    ])
      .then(([c, p]) => {
        setCustomers(c.data);
        setProducts(p.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function submit(status: 'DRAFT' | 'CONFIRMED') {
    setError('');
    setSaving(true);
    try {
      const items = lines.filter((l) => l.productId && l.quantity > 0);
      if (!customerId || items.length === 0) {
        throw new Error('Select a customer and at least one product');
      }
      const res = await api<{ data: { id: string } }>('/challans', {
        method: 'POST',
        body: JSON.stringify({ customerId, items, status }),
      });
      navigate(`/challans/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create challan');
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/challans" className="back-link">
            ← Challans
          </Link>
          <h1>New sales challan</h1>
          <p>Add products, then save as draft or confirm (reduces stock)</p>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="panel" onSubmit={onSubmit}>
        <label>
          Customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName} — {c.name}
              </option>
            ))}
          </select>
        </label>

        <h2 style={{ marginTop: '1.5rem' }}>Products</h2>
        <div className="line-list">
          {lines.map((line, index) => {
            const product = products.find((p) => p.id === line.productId);
            return (
              <div className="line-row" key={index}>
                <select
                  value={line.productId}
                  onChange={(e) => updateLine(index, { productId: e.target.value })}
                  required
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — stock {p.currentStock}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                />
                <div className="muted">
                  {product
                    ? `₹${Number(product.unitPrice).toLocaleString()} · avail ${product.currentStock}`
                    : '—'}
                </div>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  disabled={lines.length === 1}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => setLines((prev) => [...prev, { productId: '', quantity: 1 }])}
        >
          Add product line
        </button>

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button
            className="btn"
            type="button"
            disabled={saving}
            onClick={() => submit('DRAFT')}
          >
            Save as Draft
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving}
            onClick={() => submit('CONFIRMED')}
          >
            {saving ? 'Saving…' : 'Confirm & reduce stock'}
          </button>
        </div>
      </form>
    </div>
  );
}
