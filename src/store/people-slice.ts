import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Person } from "@/lib/api/people-schemas"
import { UDHAR_EXISTING_PERSONS } from "@/features/accounts/accounts-mock-data"

const SEED_PEOPLE: Person[] = UDHAR_EXISTING_PERSONS.map((p) => ({
  id: p.id,
  name: p.name,
  phoneNumber: "",
  isActive: true,
  createdAt: "",
  updatedAt: "",
}))

type PeopleState = {
  items: Person[]
}

const initialState: PeopleState = {
  items: SEED_PEOPLE,
}

export const peopleSlice = createSlice({
  name: "people",
  initialState,
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
    resetPeople: () => initialState,
  },
})

export const { setPeople, addPerson, resetPeople } = peopleSlice.actions
