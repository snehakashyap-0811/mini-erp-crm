import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ChallansPage from './pages/ChallansPage';
import ChallanCreatePage from './pages/ChallanCreatePage';
import ChallanDetailPage from './pages/ChallanDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route
              element={<ProtectedRoute roles={['ADMIN', 'SALES', 'ACCOUNTS']} />}
            >
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
            </Route>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/challans" element={<ChallansPage />} />
            <Route
              element={<ProtectedRoute roles={['ADMIN', 'SALES']} />}
            >
              <Route path="/challans/new" element={<ChallanCreatePage />} />
            </Route>
            <Route path="/challans/:id" element={<ChallanDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
