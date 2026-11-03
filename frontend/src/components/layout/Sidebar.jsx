import {
  LayoutDashboard,
  UserRound,
  FileText,
  History,
  BarChart3,
  SlidersHorizontal,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("mockmate_token");
    localStorage.removeItem("mockmate_user");
    navigate("/login");
  };

  const links = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "My Profile",
      path: "/profile",
      icon: UserRound,
    },
    {
      name: "Resume",
      path: "/resume",
      icon: FileText,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: SlidersHorizontal,
    },
    {
      name: "Interviews",
      path: "/interviews",
      icon: History,
    },
    {
      name: "Evaluation",
      path: "/evaluation",
      icon: BarChart3,
    },
  ];

  return (
    <aside className={`mm-sidebar ${collapsed ? "collapsed" : ""}`}>

      <div className="mm-sidebar-header">

        <div className="mm-brand">

          <div className="mm-brand-icon">
            <Sparkles size={19} />
          </div>

          {!collapsed && (
            <span>MockMate</span>
          )}

        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? (
            <ChevronRight size={17} />
          ) : (
            <ChevronLeft size={17} />
          )}
        </button>

      </div>

      <div className="mm-sidebar-section">

        {!collapsed && (
          <p className="sidebar-label">
            WORKSPACE
          </p>
        )}

        <nav>

          {links.map((link) => {

            const Icon = link.icon;

            return (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `mm-sidebar-link ${
                    isActive ? "active" : ""
                  }`
                }
              >

                <Icon size={18} />

                {!collapsed && (
                  <span>{link.name}</span>
                )}

              </NavLink>
            );

          })}

        </nav>

      </div>

      <div className="mm-sidebar-bottom">

        {!collapsed && (
          <p className="sidebar-label">
            ACCOUNT
          </p>
        )}

        <NavLink to="/settings" className="mm-sidebar-link">
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          className="mm-sidebar-link logout-link"
          onClick={handleLogout}
        >
          <LogOut size={18} />

          {!collapsed && (
            <span>Logout</span>
          )}
        </button>

      </div>

    </aside>
  );
}

export default Sidebar;