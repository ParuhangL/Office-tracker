import { NavLink } from 'react-router-dom'
import { logout } from '../api'
import './Navbar.css'

function Navbar({ auth, onLogout }) {

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // token may already be invalid, proceed anyway
    }
    onLogout()
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">🕐 Office Tracker</div>

      <div className="navbar-links">
        <NavLink
          to="/today"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >Today</NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >History</NavLink>

        <NavLink
          to="/monthly"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >Monthly</NavLink>

        {auth?.is_staff && (
          <NavLink
            to="/admin"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >Admin</NavLink>
        )}
      </div>

      <div className="navbar-user">
        <NavLink
          to="/profile"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          style={{ fontSize: '0.9rem' }}
        >
          👤 {auth?.username}
        </NavLink>
        {auth?.is_staff && (
          <span className="navbar-badge">Admin</span>
        )}
        <button className="btn btn-red btn-sm" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </nav>
  )
}

export default Navbar