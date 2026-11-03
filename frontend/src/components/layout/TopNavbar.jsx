import { useEffect, useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
} from "lucide-react";

function TopNavbar() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mockmate_user") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const syncUser = () => {
      try {
        setUser(JSON.parse(localStorage.getItem("mockmate_user") || "{}"));
      } catch {
        setUser({});
      }
    };
    window.addEventListener("mockmate-user-updated", syncUser);

    const token = localStorage.getItem("mockmate_token");
    if (!token) return () => window.removeEventListener("mockmate-user-updated", syncUser);

    fetch("http://127.0.0.1:8000/api/profile", {
      headers: { Authorization: "Bearer " + token },
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load profile picture");
        return data;
      })
      .then((profile) => {
        if (!profile) return;
        const currentUser = JSON.parse(localStorage.getItem("mockmate_user") || "{}");
        const nextUser = { ...currentUser, profile_picture_url: profile.profile_picture_url || "" };
        setUser(nextUser);
        localStorage.setItem("mockmate_user", JSON.stringify(nextUser));
      })
      .catch((error) => console.error("Unable to load profile picture:", error));
    return () => window.removeEventListener("mockmate-user-updated", syncUser);
  }, []);

  const pictureSource = user.profile_picture_url
    ? `http://127.0.0.1:8000${user.profile_picture_url}`
    : "";

  return (
    <header className="mm-topbar">

      <div className="topbar-search">

        <Search size={18} />

        <input
          type="text"
          placeholder="Search..."
        />

        <span className="search-shortcut">
          Ctrl K
        </span>

      </div>

      <div className="topbar-right">

        <button
          className="topbar-icon"
          aria-label="Notifications"
        >
          <Bell size={19} />

          <span className="notification-dot" />
        </button>

        <div className="topbar-user">

        {pictureSource ? (
          <img className="user-avatar user-avatar-image" src={pictureSource} alt="" />
        ) : (
          <div className="user-avatar">
            {user.name
              ? user.name.charAt(0).toUpperCase()
              : "U"}
          </div>
        )}

          <div className="user-info">

            <strong>
              {user.name || "User"}
            </strong>

            <span>
              Candidate
            </span>

          </div>

          <ChevronDown size={16} />

        </div>

      </div>

    </header>
  );
}

export default TopNavbar;