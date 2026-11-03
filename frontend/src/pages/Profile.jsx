import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  GraduationCap,
  Phone,
  Save,
  Sparkles,
  Upload,
  UserRound,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

const API_BASE = "http://127.0.0.1:8000/api";
const FOCUS_OPTIONS = ["Technical", "Behavioral", "HR", "System design"];

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("mockmate_user") || "{}");
  } catch {
    return {};
  }
}

function Profile() {
  const [profile, setProfile] = useState({
    phone: "",
    skills: "",
    education: "",
    experience: "",
    resume: "",
    profile_picture_url: "",
  });
  const [careerGoal, setCareerGoal] = useState(
    () => localStorage.getItem("mockmate_career_goal") || ""
  );
  const [interviewFocus, setInterviewFocus] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mockmate_interview_focus") || '["Technical"]');
      return Array.isArray(saved) ? saved : ["Technical"];
    } catch {
      return ["Technical"];
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pictureInputRef = useRef(null);
  const user = readUser();
  const token = localStorage.getItem("mockmate_token");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) return;
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to load profile");
        setProfile({
          phone: data.phone || "",
          skills: data.skills || "",
          education: data.education || "",
          experience: data.experience || "",
          resume: data.resume || "",
          profile_picture_url: data.profile_picture_url || "",
        });
        const savedUser = readUser();
        localStorage.setItem("mockmate_user", JSON.stringify({
          ...savedUser,
          profile_picture_url: data.profile_picture_url || "",
        }));
      } catch (loadError) {
        setError(loadError.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [token]);

  const handleChange = (event) => {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
    setMessage("");
    setError("");
  };

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingPicture(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API_BASE}/profile/picture`, {
        method: "POST",
        headers: { Authorization: "Bearer " + localStorage.getItem("mockmate_token") },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to upload profile picture");

      setProfile((current) => ({
        ...current,
        profile_picture_url: data.profile_picture_url,
      }));
      const savedUser = readUser();
      localStorage.setItem("mockmate_user", JSON.stringify({
        ...savedUser,
        profile_picture_url: data.profile_picture_url,
      }));
      window.dispatchEvent(new Event("mockmate-user-updated"));
      setMessage("Profile picture updated.");
    } catch (uploadError) {
      setError(uploadError.message || "Failed to upload profile picture.");
    } finally {
      setUploadingPicture(false);
    }
  };

  const pictureSource = profile.profile_picture_url
    ? `http://127.0.0.1:8000${profile.profile_picture_url}`
    : "";

  const toggleFocus = (focus) => {
    setInterviewFocus((current) =>
      current.includes(focus)
        ? current.filter((item) => item !== focus)
        : [...current, focus]
    );
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to save profile");
      if (data.profile) {
        setProfile((current) => ({ ...current, ...data.profile }));
      }
      localStorage.setItem("mockmate_career_goal", careerGoal);
      localStorage.setItem("mockmate_interview_focus", JSON.stringify(interviewFocus));
      setMessage("Profile and practice focus saved.");
    } catch (saveError) {
      setError(saveError.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const completedFields = [
    profile.phone,
    profile.skills,
    profile.education,
    profile.experience,
    careerGoal,
    profile.resume,
  ].filter((value) => Boolean(String(value || "").trim())).length;
  const completion = Math.round((completedFields / 6) * 100);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="account-loading">Loading your candidate profile...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="account-page">
        <div className="account-page-heading">
          <div>
            <p className="dashboard-eyebrow">YOUR ACCOUNT</p>
            <h1>Candidate profile</h1>
            <p>Keep your experience and career direction ready for every practice session.</p>
          </div>
          <Link className="account-heading-link" to="/resume">
            Manage resume <ArrowUpRight size={16} />
          </Link>
        </div>

        {message && <div className="account-alert success"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="account-alert error">{error}</div>}

        <div className="account-page-grid">
          <div className="account-page-main">
            <Card className="account-panel">
              <div className="account-panel-heading">
                <span className="account-panel-icon violet"><UserRound size={18} /></span>
                <div><h2>Personal details</h2><p>These details are saved to your MockMate candidate profile.</p></div>
              </div>
              <div className="account-identity-strip">
                {pictureSource ? (
                  <img className="account-user-avatar" src={pictureSource} alt={`${user.name || "User"} profile`} />
                ) : (
                  <span className="account-user-avatar">{(user.name || "C").slice(0, 1).toUpperCase()}</span>
                )}
                <div><strong>{user.name || "Candidate"}</strong><span>{user.email || "Account email"}</span></div>
                <input
                  ref={pictureInputRef}
                  className="profile-picture-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Choose a profile picture"
                  onChange={handleProfilePictureUpload}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="profile-picture-upload"
                  disabled={uploadingPicture}
                  onClick={() => pictureInputRef.current?.click()}
                >
                  {uploadingPicture ? <Upload size={15} /> : <Camera size={15} />}
                  {uploadingPicture ? "Uploading..." : "Change photo"}
                </Button>
                <span className="account-verified-pill"><CheckCircle2 size={14} />Account</span>
              </div>
              <p className="profile-picture-hint">PNG, JPEG, or WEBP. Maximum file size: 5 MB.</p>
              <form onSubmit={handleSubmit}>
                <div className="profile-form-grid account-form-grid">
                  <div className="profile-field">
                    <label htmlFor="profile-phone"><Phone size={15} />Phone number</label>
                    <input id="profile-phone" name="phone" value={profile.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="profile-education"><GraduationCap size={15} />Education</label>
                    <input id="profile-education" name="education" value={profile.education} onChange={handleChange} placeholder="Degree, institution, or certification" />
                  </div>
                  <div className="profile-field full-width">
                    <label htmlFor="profile-skills"><Wrench size={15} />Skills and specialties</label>
                    <input id="profile-skills" name="skills" value={profile.skills} onChange={handleChange} placeholder="Python, SQL, analytics, project leadership..." />
                  </div>
                  <div className="profile-field full-width">
                    <label htmlFor="profile-experience"><BriefcaseBusiness size={15} />Experience and projects</label>
                    <textarea id="profile-experience" name="experience" value={profile.experience} onChange={handleChange} placeholder="Add your experience, internships, achievements, or projects." rows={5} />
                  </div>
                  <div className="profile-field full-width">
                    <label htmlFor="career-goal"><Sparkles size={15} />Target role or career goal</label>
                    <input id="career-goal" value={careerGoal} onChange={(event) => { setCareerGoal(event.target.value); setMessage(""); }} placeholder="e.g. Data Scientist at a product company" />
                  </div>
                </div>
                <div className="account-focus-section">
                  <div><strong>Practice focus</strong><span>Choose topics you want to work on most.</span></div>
                  <div className="account-focus-options">
                    {FOCUS_OPTIONS.map((focus) => (
                      <label key={focus} className={`account-focus-chip${interviewFocus.includes(focus) ? " selected" : ""}`}>
                        <input type="checkbox" checked={interviewFocus.includes(focus)} onChange={() => toggleFocus(focus)} />
                        {focus}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="profile-form-footer account-form-footer">
                  <Button type="submit" disabled={saving}><Save size={16} />{saving ? "Saving..." : "Save profile"}</Button>
                </div>
              </form>
            </Card>
          </div>

          <aside className="account-side-column">
            <Card className="account-panel account-progress-panel">
              <p className="account-card-eyebrow">PROFILE READINESS</p>
              <div className="account-progress-value"><strong>{completion}%</strong><span>complete</span></div>
              <div className="account-progress-track"><span style={{ width: `${completion}%` }} /></div>
              <p className="account-help-text">A complete profile gives your interview practice better context.</p>
              <div className="account-checklist">
                {[
                  ["Skills", profile.skills],
                  ["Experience", profile.experience],
                  ["Career goal", careerGoal],
                  ["Resume", profile.resume],
                ].map(([label, value]) => (
                  <div key={label} className="account-check-row">
                    <CheckCircle2 size={15} className={value ? "complete" : ""} />
                    <span>{label}</span>
                    <small>{value ? "Added" : "Add details"}</small>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="account-panel account-next-step">
              <span className="account-panel-icon teal"><Sparkles size={18} /></span>
              <h2>Next step</h2>
              <p>Keep your resume up to date so your practice sessions reflect your latest experience.</p>
              <Link to="/resume">Open resume workspace <ArrowUpRight size={15} /></Link>
            </Card>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Profile;
