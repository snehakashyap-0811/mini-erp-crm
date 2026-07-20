import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getUser } from '../lib/auth';

const links = [
  { to: '/', label: 'Dashboard', roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] },
  { to: '/customers', label: 'Customers', roles: ['ADMIN', 'SALES', 'ACCOUNTS'] },
  { to: '/products', label: 'Products', roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] },
  { to: '/challans', label: 'Sales Challans', roles: ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'] },
];

export default function Layout() {
  const user = getUser();
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">ERP</span>
          <div>
            <strong>Mini ERP</strong>
            <small>CRM Operations</small>
          </div>
        </div>
        <nav>
          {links
            .filter((l) => user && l.roles.includes(user.role))
            .map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'}>
                {l.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-user">
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
