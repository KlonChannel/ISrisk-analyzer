import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../api/client";
import { createSession } from "../session/sessionSlice";
import { toErrorMessage } from "../../utils/errorMessage";

export const fetchReportPage = createAsyncThunk(
  "results/fetchPage",
  async ({ sessionId, page, pageSize = 10 }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/results/report", {
        params: { session_id: sessionId, page, page_size: pageSize },
      });
      return data;
    } catch (e) {
      return rejectWithValue(e.response?.data?.detail || e.message);
    }
  }
);

const makeInitialState = () => ({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
  rows: [],
  status: "idle",
  error: null,
});

const resultsSlice = createSlice({
  name: "results",
  initialState: makeInitialState(),
  reducers: {
    resetResults: () => makeInitialState(),
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSession.fulfilled, () => makeInitialState())

      .addCase(fetchReportPage.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchReportPage.fulfilled, (state, action) => {
        state.status = "ready";
        state.page = action.payload.page;
        state.pageSize = action.payload.page_size;
        state.total = action.payload.total;
        state.totalPages = action.payload.total_pages;
        state.rows = action.payload.rows;
      })
      .addCase(fetchReportPage.rejected, (state, action) => {
        state.status = "error";
        state.error = toErrorMessage(action.payload, action.error.message);
      });
  },
});

export const { resetResults } = resultsSlice.actions;
export default resultsSlice.reducer;