import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../api/client";
import { createSession } from "../session/sessionSlice";
import { startAnalysis  } from "../analysis/analysisSlice";
import { toErrorMessage } from "../../utils/errorMessage";

export const fetchPlotFilters = createAsyncThunk(
  "plots/fetchFilters",
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/plot/available", {
        params: { session_id: sessionId },
      });
      return { sessionId, data };
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

export const fetchPlot = createAsyncThunk(
  "plots/fetchOne",
  async (
    { sessionId, kind, department, eventType, level },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await api.get(`/plot/${kind}`, {
        params: {
          session_id: sessionId,
          department,
          event_type: eventType,
          level,
        },
      });
      return { sessionId, kind, image: data.image };
    } catch (e) {
      return rejectWithValue({
        sessionId,
        kind,
        error: e.response?.data?.detail || e.message,
      });
    }
  }
);

const PLOT_KINDS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

const makeInitialState = () => ({
  sessionId: null,
  filters: {
    departments: ["Все"],
    events: ["Все"],
    levels: ["Все"],
  },
  current: {
    department: "Все",
    eventType: "Все",
    level: "Все",
  },
  images: {},
  errors: {},
  loading: {},
  status: "idle",
  error: null,
});

const plotsSlice = createSlice({
  name: "plots",
  initialState: makeInitialState(),
  reducers: {
    setFilter(state, action) {
      const { name, value } = action.payload;
      state.current[name] = value;
    },
    resetPlots: (state) => {
      state.current = {
        department: "Все",
        eventType: "Все",
        level: "Все",
      };
      // Очищаем загруженные графики и ошибки
      state.images = {};
      state.errors = {};
      state.loading = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSession.fulfilled, () => makeInitialState())

      .addCase(startAnalysis.fulfilled, (state) => {
        state.current = {
          department: "Все",
          eventType: "Все",
          level: "Все",
        };
        // Очищаем загруженные графики и ошибки
        state.images = {};
        state.errors = {};
        state.loading = {};
      })

      .addCase(fetchPlotFilters.fulfilled, (state, action) => {
        if (state.sessionId && state.sessionId !== action.payload.sessionId)
          return;
        state.filters = {
          departments: action.payload.data.departments,
          events: action.payload.data.events,
          levels: action.payload.data.levels,
        };
      })

      .addCase(fetchPlot.pending, (state, action) => {
        state.sessionId = action.meta.arg.sessionId;
        state.loading[action.meta.arg.kind] = true;
        state.errors[action.meta.arg.kind] = null;
      })
      .addCase(fetchPlot.fulfilled, (state, action) => {
        if (state.sessionId !== action.payload.sessionId) return;
        const { kind, image } = action.payload;
        state.images[kind] = image;
        state.loading[kind] = false;
      })
      .addCase(fetchPlot.rejected, (state, action) => {
        const kind = action.payload?.kind || action.meta.arg.kind;
        const sid = action.payload?.sessionId || action.meta.arg.sessionId;
        if (state.sessionId !== sid) return;
        state.loading[kind] = false;
        state.errors[kind] = toErrorMessage(
          action.payload?.error,
          action.error.message
        );
      });
  },
});

export const { setFilter, resetPlots } = plotsSlice.actions;
export { PLOT_KINDS };
export default plotsSlice.reducer;