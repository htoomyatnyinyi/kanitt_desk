import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import { SystemBackProvider } from "./hooks/SystemBackProvider";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <SystemBackProvider>
        <App />
      </SystemBackProvider>
    </Provider>
  </React.StrictMode>,
);
