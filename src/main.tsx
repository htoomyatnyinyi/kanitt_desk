import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App";
import "./index.css";
import AppClinic from "./components/clinic_pharmacy_pos_simulation";
import AppNew from "./components/clinic_pharmacy_pos_simulator";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
      {/* <AppClinic /> */}
      {/* <AppNew /> */}
    </Provider>
  </React.StrictMode>,
);
