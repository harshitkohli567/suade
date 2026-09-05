import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* global document, module */

const container = document.getElementById("root");
if (!container) {
  throw new Error("Suade web workspace: could not find #root element to mount into.");
}
const root = createRoot(container);
root.render(<App />);

// Hot module replacement for local dev only — no effect in production build.
if ((module as any).hot) {
  (module as any).hot.accept();
}
