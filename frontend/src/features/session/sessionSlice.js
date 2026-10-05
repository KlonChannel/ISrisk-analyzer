import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../api/client";

// Создание новой сессии на бэкенде
export const createSession = createAsyncThunk("session/create", async () => {
  const { data } = await api.post("/session");
  return data.session_id;
});

// Проверка /api/health
export const checkHealth = createAsyncThunk("session/health", async () => {
  const { data } = await api.get("/health");
  return data;
});

const initialState = {
  sessionId: null,
  status: "idle",
  health: null,
  error: null,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSession.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.status = "ready";
        state.sessionId = action.payload;
      })
      .addCase(createSession.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message;
      })
      .addCase(checkHealth.fulfilled, (state, action) => {
        state.health = action.payload;
      })
      .addCase(checkHealth.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

export const { clearError } = sessionSlice.actions;
export default sessionSlice.reducer;