import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

type CreditCardPaymentUiState = {
  selectedCreditCardId: string | null
  isMinimumPaymentEnabled: boolean
  minimumAmount: number | null
}

const initialState: CreditCardPaymentUiState = {
  selectedCreditCardId: null,
  isMinimumPaymentEnabled: false,
  minimumAmount: null,
}

export const creditCardPaymentUiSlice = createSlice({
  name: "creditCardPaymentUi",
  initialState,
  reducers: {
    setSelectedCreditCardId(state, action: PayloadAction<string | null>) {
      const next = action.payload?.trim() ?? ""
      state.selectedCreditCardId = next.length > 0 ? next : null
    },
    setIsMinimumPaymentEnabled(state, action: PayloadAction<boolean>) {
      state.isMinimumPaymentEnabled = action.payload
      if (!action.payload) state.minimumAmount = null
    },
    setMinimumAmount(state, action: PayloadAction<number | null>) {
      state.minimumAmount = action.payload
    },
    clearCreditCardPaymentUi(state) {
      state.selectedCreditCardId = null
      state.isMinimumPaymentEnabled = false
      state.minimumAmount = null
    },
  },
})

export const {
  setSelectedCreditCardId,
  setIsMinimumPaymentEnabled,
  setMinimumAmount,
  clearCreditCardPaymentUi,
} = creditCardPaymentUiSlice.actions
