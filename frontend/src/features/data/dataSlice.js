import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../api/client";
import { createSession } from "../session/sessionSlice";
import { toErrorMessage } from "../../utils/errorMessage";

export const generateData = createAsyncThunk(
  "data/generate",
  async ({ sessionId, scenario, nSamples }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/data/generate", {
        session_id: sessionId,
        scenario,
        n_samples: nSamples,
      });
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

export const uploadFile = createAsyncThunk(
  "data/upload",
  async ({ sessionId, file }, { rejectWithValue }) => {
    try {
      const form = new FormData();
      form.append("session_id", sessionId);
      form.append("file", file);
      const { data } = await api.post("/data/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

export const fetchPreview = createAsyncThunk(
  "data/fetchPreview",
  async ({ sessionId, page }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/data/preview", {
        params: { session_id: sessionId, page },
      });
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

const makeInitialState = () => ({
  rows: 0,
  columns: [],
  preview: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    rows: [],
  },
  status: "idle",
  error: null,
  source: null,
});

const dataSlice = createSlice({
  name: "data",
  initialState: makeInitialState(),
  reducers: {
    resetData: () => makeInitialState(),
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSession.fulfilled, () => makeInitialState())

      .addCase(generateData.pending, (state) => {
        state.status = "generating";
        state.error = null;
        state.rows = 0;
        state.columns = [];
        state.source = null;
        state.preview = makeInitialState().preview;
      })
      .addCase(generateData.fulfilled, (state, action) => {
        state.status = "ready";
        state.rows = action.payload.rows;
        state.columns = action.payload.columns;
        state.source = "generate";
        state.preview.page = 1;
      })
      .addCase(generateData.rejected, (state, action) => {
        state.status = "error";
        state.error = toErrorMessage(action.payload, action.error.message);
      })

      .addCase(uploadFile.pending, (state) => {
        state.status = "uploading";
        state.error = null;
        state.rows = 0;
        state.columns = [];
        state.source = null;
        state.preview = makeInitialState().preview;
      })
      .addCase(uploadFile.fulfilled, (state, action) => {
        state.status = "ready";
        state.rows = action.payload.rows;
        state.columns = action.payload.columns;
        state.source = "upload";
        state.preview.page = 1;
      })
      .addCase(uploadFile.rejected, (state, action) => {
        state.status = "error";
        state.error = toErrorMessage(action.payload, action.error.message);
      })

      .addCase(fetchPreview.pending, (state) => {
        state.status = "loadingPreview";
      })
      .addCase(fetchPreview.fulfilled, (state, action) => {
        state.status = "ready";
        state.preview = {
          page: action.payload.page,
          pageSize: action.payload.page_size,
          total: action.payload.total,
          totalPages: action.payload.total_pages,
          rows: action.payload.rows,
        };
      })
      .addCase(fetchPreview.rejected, (state, action) => {
        state.status = "error";
        state.error = toErrorMessage(action.payload, action.error.message);
      });
  },
});

export const { resetData, clearError } = dataSlice.actions;
export default dataSlice.reducer;