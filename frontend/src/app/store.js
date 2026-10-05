import { configureStore } from "@reduxjs/toolkit";
import sessionReducer from "../features/session/sessionSlice";
import dataReducer from "../features/data/dataSlice";
import analysisReducer from "../features/analysis/analysisSlice";
import resultsReducer from "../features/results/resultsSlice";
import plotsReducer from "../features/plots/plotsSlice";

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    data: dataReducer,
    analysis: analysisReducer,
    results: resultsReducer,
    plots: plotsReducer,
  },
});