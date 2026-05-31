import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Person } from "@/lib/api/people-schemas"

type PeopleState = {
  items: Person[]
}

const emptyState: PeopleState = { items: [] }

export const peopleSlice = createSlice({
  name: "people",
  initialState: emptyState,
  reducers: {
    setPeople(state, action: PayloadAction<Person[]>) {
      state.items = action.payload
    },
    addPerson(state, action: PayloadAction<Person>) {
      const exists = state.items.some((p) => p.id === action.payload.id)
      if (!exists) {
        state.items.push(action.payload)
      }
    },
    resetPeople: () => emptyState,
  },
})

export const { setPeople, addPerson, resetPeople } = peopleSlice.actions
