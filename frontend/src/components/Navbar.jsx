import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const linksByRole = {
  participant: [
    { to: '/', label: 'Dashboard' },
    { to: '/events', label: 'Browse Events' },
    { to: '/organizers', label: 'Clubs/Organizers' },
    { to: '/profile', label: 'Profile' }
  ],
  organizer: [
    { to: '/', label: 'Dashboard' },
    { to: '/organizer/events/new', label: 'Create Event' },
    { to: '/organizer/ongoing', label: 'Ongoing Events' },
    { to: '/profile', label: 'Profile' }
  ],
  admin: [
    { to: '/', label: 'Dashboard' },
    { to: '/admin/organizers', label: 'Manage Clubs/Organizers' },
    { to: '/admin/reset-requests', label: 'Password Reset Requests' }
  ]
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const links = linksByRole[user.role] || [];

  return (
    <nav className="navbar">
      <div className="brand">Felicity Connect</div>
      <div className="nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            end
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          logout();
          navigate('/login');
        }}
      >
        Logout
      </button>
    </nav>
  );
}
