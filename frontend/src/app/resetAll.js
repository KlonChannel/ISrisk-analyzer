import { resetData } from "../features/data/dataSlice";
import { resetAnalysis } from "../features/analysis/analysisSlice";
import { resetResults } from "../features/results/resultsSlice";
import { resetPlots } from "../features/plots/plotsSlice";

export const resetAll = () => (dispatch) => {
  dispatch(resetData());
  dispatch(resetAnalysis());
  dispatch(resetResults());
  dispatch(resetPlots());
};