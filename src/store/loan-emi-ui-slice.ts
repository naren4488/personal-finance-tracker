import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

type LoanEmiUiState = {
  selectedLoanAccountId: string | null
}

const initialState: LoanEmiUiState = {
  selectedLoanAccountId: null,
}

export const loanEmiUiSlice = createSlice({
  name: "loanEmiUi",
  initialState,
  reducers: {
    setSelectedLoanAccountId(state, action: PayloadAction<string | null>) {
      const next = action.payload?.trim() ?? ""
      state.selectedLoanAccountId = next.length > 0 ? next : null
    },
    clearSelectedLoanAccountId(state) {
      state.selectedLoanAccountId = null
    },
  },
})

export const { setSelectedLoanAccountId, clearSelectedLoanAccountId } = loanEmiUiSlice.actions
