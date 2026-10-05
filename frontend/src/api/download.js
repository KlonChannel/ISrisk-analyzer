import { api } from "./client";

export const downloadReport = async (format, sessionId) => {
  const response = await api.get(`/report/${format}`, {
    params: { session_id: sessionId },
    responseType: "blob",
  });

  // Попытка извлечь имя файла из Content-Disposition
  const dispo = response.headers["content-disposition"] || "";
  const match = dispo.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `report.${format}`;

  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadDataset = async (format, sessionId) => {
  const response = await api.get(`/dataset/${format}`, {
    params: { session_id: sessionId },
    responseType: "blob",
  });

  const dispo = response.headers["content-disposition"] || "";
  const match = dispo.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `dataset.${format}`;

  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadPlotsZip = async (sessionId, filters) => {
  const response = await api.get("/plots/zip", {
    params: {
      session_id: sessionId,
      department: filters.department,
      event_type: filters.eventType,
      level: filters.level,
    },
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "application/zip" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plots.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}; 