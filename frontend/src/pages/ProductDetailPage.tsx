import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Movement = {
  id: string;
  quantity: number;
  type: string;
  reason: string;
  createdAt: string;
  createdBy: { name: string };
};

type ProductDetail = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: string | number;
  currentStock: number;
  minStockAlert: number;
  location: string;
  stockMoves: Movement[];
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ data: ProductDetail }>(`/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!product) return <div className="muted">Loading…</div>;

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/products" className="back-link">
            ← Products
          </Link>
          <h1>{product.name}</h1>
          <p>
            {product.sku} · {product.category}
          </p>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Unit price</span>
          <strong>₹{Number(product.unitPrice).toLocaleString()}</strong>
        </div>
        <div className="stat-card">
          <span>Current stock</span>
          <strong className={product.currentStock <= product.minStockAlert ? 'danger' : ''}>
            {product.currentStock}
          </strong>
        </div>
        <div className="stat-card">
          <span>Min alert</span>
          <strong>{product.minStockAlert}</strong>
        </div>
        <div className="stat-card">
          <span>Location</span>
          <strong style={{ fontSize: '1.1rem' }}>{product.location}</strong>
        </div>
      </div>

      <section className="panel">
        <h2>Stock movement log</h2>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Reason</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {product.stockMoves.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.createdAt).toLocaleString()}</td>
                <td>
                  <span className={`badge badge-${m.type.toLowerCase()}`}>{m.type}</span>
                </td>
                <td>{m.quantity}</td>
                <td>{m.reason}</td>
                <td>{m.createdBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
