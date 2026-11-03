import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";

function DashboardLayout({ children, dark, immersive = false }) {
  const useDarkTheme = dark ?? !immersive;

  return (
    <div className={`mm-app${useDarkTheme ? " mm-app-dark" : ""}${immersive ? " mm-app-immersive" : ""}`}>
      {immersive ? (
        <main className="mm-content">
          {children}
        </main>
      ) : (
        <>
          <Sidebar />
          <div className="mm-main">
            <TopNavbar />
            <main className="mm-content">{children}</main>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardLayout;