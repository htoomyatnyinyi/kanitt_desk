import { configureStore } from "@reduxjs/toolkit";
import { kanittApi } from "./apiSlice";

export const store = configureStore({
  reducer: {
    [kanittApi.reducerPath]: kanittApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(kanittApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
