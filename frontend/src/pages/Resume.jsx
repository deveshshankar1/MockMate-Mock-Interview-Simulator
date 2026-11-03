import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Lightbulb,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import Card from "../components/ui/Card";

const API_BASE = "http://127.0.0.1:8000/api";

function Resume() {
  const token = localStorage.getItem("mockmate_token");
  const [resume, setResume] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showText, setShowText] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadResume = async () => {
      try {
        const response = await fetch(`${API_BASE}/resume/latest`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) {
          if (active) setResume(null);
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load your resume.");
        if (active) setResume(data);
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load your resume.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadResume();
    return () => { active = false; };
  }, [token]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a PDF or DOCX resume first.");
      return;
    }
    setUploading(true);
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const response = await fetch(`${API_BASE}/resume/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Resume upload failed.");
      setResume({
        filename: data.filename,
        extracted_text: data.extracted_text || "",
        text_length: data.text_length || 0,
        uploaded_at: new Date().toISOString(),
      });
      setSelectedFile(null);
      setShowText(false);
      setMessage("Resume uploaded and text extracted successfully.");
    } catch (uploadError) {
      setError(uploadError.message || "Resume upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const wordCount = resume?.extracted_text?.trim()
    ? resume.extracted_text.trim().split(/\s+/).length
    : 0;

  return (
    <DashboardLayout>
      <div className="account-page resume-workspace">
        <div className="account-page-heading">
          <div>
            <p className="dashboard-eyebrow">CAREER MATERIALS</p>
            <h1>Resume workspace</h1>
            <p>Manage your latest resume and check the text MockMate can use for interview context.</p>
          </div>
          <Link className="account-heading-link" to="/profile">Candidate profile <ArrowUpRight size={16} /></Link>
        </div>

        {message && <div className="account-alert success"><CheckCircle2 size={17} />{message}</div>}
        {error && <div className="account-alert error">{error}</div>}

        <div className="resume-workspace-grid">
          <div className="resume-workspace-main">
            <Card className="account-panel resume-upload-panel">
              <div className="account-panel-heading">
                <span className="account-panel-icon violet"><Upload size={18} /></span>
                <div><h2>{resume ? "Replace your resume" : "Add your resume"}</h2><p>Upload a PDF or DOCX. The newest upload becomes your active resume.</p></div>
              </div>
              <form onSubmit={handleUpload}>
                <label className="resume-dropzone">
                  <span className="resume-dropzone-icon"><FileText size={23} /></span>
                  <strong>{selectedFile ? selectedFile.name : "Choose a resume file"}</strong>
                  <small>{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to upload` : "PDF or DOCX format"}</small>
                  <span className="resume-choose-btn"><Upload size={15} />Browse files</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => { setSelectedFile(event.target.files?.[0] || null); setError(""); setMessage(""); }}
                  />
                </label>
                <div className="resume-upload-actions">
                  <span>Only upload a resume you have permission to share.</span>
                  <button type="submit" className="dashboard-primary-action" disabled={!selectedFile || uploading}>
                    <Upload size={15} />{uploading ? "Extracting resume..." : "Upload resume"}
                  </button>
                </div>
              </form>
            </Card>

            <Card className="account-panel resume-current-panel">
              <div className="resume-current-heading">
                <div className="account-panel-heading">
                  <span className="account-panel-icon teal"><FileCheck2 size={18} /></span>
                  <div><h2>Current resume</h2><p>Your latest saved document and extracted content.</p></div>
                </div>
                {resume?.extracted_text && (
                  <button type="button" className="account-secondary-action" onClick={() => setShowText((visible) => !visible)}>
                    {showText ? <EyeOff size={15} /> : <Eye size={15} />}{showText ? "Hide text" : "Preview text"}
                  </button>
                )}
              </div>
              {loading ? (
                <div className="account-empty-state">Loading your saved resume...</div>
              ) : resume ? (
                <>
                  <div className="resume-file-summary">
                    <span className="resume-file-icon"><FileText size={21} /></span>
                    <div><strong>{resume.filename}</strong><small>{resume.text_length || resume.extracted_text?.length || 0} characters extracted · {wordCount} words</small></div>
                    <span className="account-verified-pill"><CheckCircle2 size={14} />Saved</span>
                  </div>
                  {showText && (
                    <div className="resume-extracted-preview">
                      {resume.extracted_text || "No selectable text was found in this document. Try uploading a text-based PDF or DOCX."}
                    </div>
                  )}
                  {!resume.extracted_text && (
                    <div className="resume-no-text"><Lightbulb size={17} />No text was extracted. Scanned PDFs may need OCR before MockMate can use their contents.</div>
                  )}
                </>
              ) : (
                <div className="account-empty-state">
                  <FileText size={25} />
                  <strong>No resume uploaded yet</strong>
                  <span>Add a PDF or DOCX above to make this workspace useful.</span>
                </div>
              )}
            </Card>
          </div>

          <aside className="account-side-column">
            <Card className="account-panel resume-usage-card">
              <span className="account-panel-icon pink"><Sparkles size={18} /></span>
              <h2>Put it to practice</h2>
              <p>Use your current skills and experience as the context for interview practice.</p>
              <Link to="/interview/setup">Start an interview <ArrowUpRight size={15} /></Link>
            </Card>
            <Card className="account-panel resume-checklist-card">
              <div className="account-panel-heading">
                <span className="account-panel-icon teal"><CheckCircle2 size={18} /></span>
                <div><h2>Resume checklist</h2><p>A quick review before you practice.</p></div>
              </div>
              {[
                ["Add measurable outcomes", "Show impact with results and numbers."],
                ["Keep skills current", "Match your skills to your target role."],
                ["Use clear sections", "Make experience and projects easy to scan."],
              ].map(([title, detail]) => (
                <div className="resume-checklist-item" key={title}>
                  <CheckCircle2 size={15} />
                  <div><strong>{title}</strong><small>{detail}</small></div>
                </div>
              ))}
            </Card>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Resume;
