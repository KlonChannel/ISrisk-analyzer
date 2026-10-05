import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../api/client";
import { createSession } from "../session/sessionSlice";
import { toErrorMessage } from "../../utils/errorMessage";

export const startAnalysis = createAsyncThunk(
  "analysis/start",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/analyze", payload);
      return { sessionId: payload.session_id, taskId: data.task_id };
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

export const fetchStatus = createAsyncThunk(
  "analysis/status",
  async ({ taskId, sessionId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/analyze/status", {
        params: { task_id: taskId },
      });
      return { sessionId, data };
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

export const fetchSummary = createAsyncThunk(
  "analysis/summary",
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/results/summary", {
        params: { session_id: sessionId },
      });
      return { sessionId, data };
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

const makeInitialState = () => ({
  sessionId: null,
  taskId: null,
  status: "idle",
  progress: 0,
  message: "",
  error: null,
  summary: null,
});

const analysisSlice = createSlice({
  name: "analysis",
  initialState: makeInitialState(),
  reducers: {
    resetAnalysis: () => makeInitialState(),
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSession.fulfilled, () => makeInitialState())

      .addCase(startAnalysis.pending, (state) => {
        state.status = "starting";
        state.error = null;
        state.progress = 0;
        state.message = "Постановка задачи...";
        state.summary = null;
      })
      .addCase(startAnalysis.fulfilled, (state, action) => {
        state.sessionId = action.payload.sessionId;
        state.status = "running";
        state.taskId = action.payload.taskId;
      })
      .addCase(startAnalysis.rejected, (state, action) => {
        state.status = "error";
        state.error = toErrorMessage(action.payload, action.error.message);
      })

      .addCase(fetchStatus.fulfilled, (state, action) => {
        if (state.sessionId !== action.payload.sessionId) return;
        const t = action.payload.data;
        state.progress = t.progress ?? state.progress;
        state.message = t.message ?? state.message;
        if (t.status === "done") {
          state.status = "done";
          state.progress = 100;
        } else if (t.status === "error") {
          state.status = "error";
          state.error = toErrorMessage(t.error, "Ошибка анализа");
        }
      })
      .addCase(fetchStatus.rejected, (state, action) => {
        state.status = "error";
        state.error = toErrorMessage(action.payload, action.error.message);
      })

      .addCase(fetchSummary.fulfilled, (state, action) => {
        if (state.sessionId !== action.payload.sessionId) return;
        state.summary = action.payload.data;
      });
  },
});

export const { resetAnalysis } = analysisSlice.actions;
export default analysisSlice.reducer;