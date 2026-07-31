import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  LineChart, 
  Activity, 
  Banknote, 
  Settings,
  Sliders
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/holdings', label: 'Holdings', icon: Briefcase },
  { path: '/options', label: 'Options Desk', icon: LineChart },
  { path: '/detailed-analysis', label: 'Detailed Analysis', icon: Sliders },
  { path: '/simulation', label: 'Simulation', icon: Activity },
  { path: '/cashflow', label: 'Cash Flow', icon: Banknote },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Command Center</h2>
        <p>Portfolio Strategy</p>
      </div>
      
      <div className="sidebar-section">
        <div className="sidebar-section-label">Main</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <item.icon className="nav-icon" size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        v0.1.0 • Local Only
      </div>
    </aside>
  );
}
