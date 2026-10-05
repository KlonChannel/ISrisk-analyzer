import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { createSession } from "../features/session/sessionSlice";
import Stepper from "./Stepper";
import icon from "../assets/favicon.ico";

const NAV_ITEMS = [
  { to: "/data", label: "Данные" },
  { to: "/analysis", label: "Анализ" },
  { to: "/results", label: "Результаты" },
  { to: "/plots", label: "Визуализация" },
];

const Layout = () => {
  const dispatch = useDispatch();
  const { sessionId, status } = useSelector((s) => s.session);

  const dataStatus = useSelector((s) => s.data.status);
  const analysisStatus = useSelector((s) => s.analysis.status);
  const resultsStatus = useSelector((s) => s.results.status);
  const plotsLoading = useSelector((s) => s.plots.loading);

  const plotsBusy = Object.values(plotsLoading || {}).some(Boolean);

  const isBusy =
    ["generating", "uploading", "loadingPreview"].includes(dataStatus) ||
    ["starting", "running"].includes(analysisStatus) ||
    resultsStatus === "loading" ||
    plotsBusy;

  const shortId = sessionId ? sessionId.slice(0, 8) + "…" : "";

  const navStyle = ({ isActive }) => ({
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: 6,
    fontWeight: 500,
    background: isActive ? "#2B7AEC" : "transparent",
    color: isActive ? "#fff" : "#1d1d1f",
    transition: "background 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          borderBottom: "1px solid #ddd",
          background: "#fafafa",
          gap: 24,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10,}}>
          <img src={icon} />
          IS Risk Analyzer
        </div>

        <nav style={{ display: "flex", gap: 6 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} style={navStyle}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          <span style={{ color: "#666" }}>
            {sessionId ? (
              <>
                Сессия: <code>{shortId}</code>
              </>
            ) : (
              "Нет сессии"
            )}
          </span>
          <button
            onClick={() => dispatch(createSession())}
            disabled={!sessionId || status === "loading" || isBusy}
            title={isBusy ? "Дождитесь завершения операции" : ""}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #2B7AEC",
              background: "#fff",
              color: sessionId && !isBusy ? "#2B7AEC" : "#999",
              cursor: sessionId && !isBusy ? "pointer" : "not-allowed",
              fontWeight: 500,
            }}
          >
            {status === "loading" || !sessionId
              ? "Подключение..."
              : isBusy
              ? "Подождите..."
              : "Новая сессия"}
          </button>
        </div>
      </header>

      <Stepper />

      <main style={{ flex: 1, padding: "0px 24px" }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;