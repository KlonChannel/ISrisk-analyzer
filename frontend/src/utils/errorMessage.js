export const toErrorMessage = (payload, fallback = "Неизвестная ошибка") => {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    return payload
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object") {
          return e.msg || e.message || JSON.stringify(e);
        }
        return String(e);
      })
      .join("; ");
  }
  if (typeof payload === "object") {
    return payload.msg || payload.message || payload.detail || JSON.stringify(payload);
  }
  return String(payload);
};