import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: string | number;
  currentStock: number;
  minStockAlert: number;
  location: string;
};

const emptyForm = {
  name: '',
  sku: '',
  category: '',
  unitPrice: '',
  currentStock: '0',
  minStockAlert: '10',
  location: '',
};

export default function ProductsPage() {
  const user = getUser();
  const canEdit = user && ['ADMIN', 'WAREHOUSE'].includes(user.role);
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: '1', type: 'IN', reason: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      if (lowStock) params.set('lowStock', 'true');
      const res = await api<{ data: Product[]; meta: { totalPages: number } }>(
        `/products?${params}`
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
  }, [page, lowStock]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unitPrice: String(p.unitPrice),
      currentStock: String(p.currentStock),
      minStockAlert: String(p.minStockAlert),
      location: p.location,
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        unitPrice: Number(form.unitPrice),
        minStockAlert: Number(form.minStockAlert),
        location: form.location,
        ...(editing ? {} : { currentStock: Number(form.currentStock) }),
      };
      if (editing) {
        await api(`/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onStockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stockModal) return;
    setSaving(true);
    try {
      await api(`/products/${stockModal.id}/stock-movements`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: Number(stockForm.quantity),
          type: stockForm.type,
          reason: stockForm.reason,
        }),
      });
      setStockModal(null);
      setStockForm({ quantity: '1', type: 'IN', reason: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Products & Inventory</h1>
          <p>Catalog, stock levels, and warehouse locations</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Add product
          </button>
        )}
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => {
              setLowStock(e.target.checked);
              setPage(1);
            }}
          />
          Low stock only
        </label>
        <button className="btn" type="button" onClick={() => { setPage(1); load(); }}>
          Search
        </button>
      </div>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/products/${p.id}`}>{p.name}</Link>
                </td>
                <td>{p.sku}</td>
                <td>{p.category}</td>
                <td>₹{Number(p.unitPrice).toLocaleString()}</td>
                <td>
                  <span className={p.currentStock <= p.minStockAlert ? 'danger' : ''}>
                    {p.currentStock}
                  </span>
                  <span className="muted"> / min {p.minStockAlert}</span>
                </td>
                <td>{p.location}</td>
                <td className="row-actions">
                  <Link to={`/products/${p.id}`}>View</Link>
                  {canEdit && (
                    <>
                      <button className="btn btn-ghost" type="button" onClick={() => openEdit(p)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => setStockModal(p)}
                      >
                        Adjust stock
                      </button>
                    </>
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
            <h2>{editing ? 'Edit product' : 'Add product'}</h2>
            <div className="form-grid">
              {(
                [
                  ['name', 'Product name'],
                  ['sku', 'SKU / code'],
                  ['category', 'Category'],
                  ['unitPrice', 'Unit price'],
                  ['minStockAlert', 'Min stock alert'],
                  ['location', 'Location / warehouse'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required
                    type={key === 'unitPrice' || key === 'minStockAlert' ? 'number' : 'text'}
                    min={key === 'unitPrice' || key === 'minStockAlert' ? 0 : undefined}
                    step={key === 'unitPrice' ? '0.01' : undefined}
                  />
                </label>
              ))}
              {!editing && (
                <label>
                  Initial stock
                  <input
                    type="number"
                    min={0}
                    value={form.currentStock}
                    onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  />
                </label>
              )}
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

      {stockModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={onStockSubmit}>
            <h2>Adjust stock — {stockModal.name}</h2>
            <p className="muted">Current stock: {stockModal.currentStock}</p>
            <div className="form-grid">
              <label>
                Type
                <select
                  value={stockForm.type}
                  onChange={(e) => setStockForm({ ...stockForm, type: e.target.value })}
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  required
                />
              </label>
              <label className="full">
                Reason
                <input
                  value={stockForm.reason}
                  onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })}
                  required
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setStockModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={saving} type="submit">
                {saving ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
