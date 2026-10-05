import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Layout from "./components/Layout";
import DataPage from "./pages/DataPage";
import AnalysisPage from "./pages/AnalysisPage";
import ResultsPage from "./pages/ResultsPage";
import PlotsPage from "./pages/PlotsPage";
import { createSession } from "./features/session/sessionSlice";

const App = () => {
  const dispatch = useDispatch();
  const { sessionId, status } = useSelector((s) => s.session);

  // Автосоздание сессии при первом запуске приложения
  useEffect(() => {
    if (!sessionId && status === "idle") {
      dispatch(createSession());
    }
  }, [sessionId, status, dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/data" replace />} />
          <Route path="data" element={<DataPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="plots" element={<PlotsPage />} />
          <Route path="*" element={<Navigate to="/data" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;