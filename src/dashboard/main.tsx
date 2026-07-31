import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import { seedDemoIfRequested } from "../lib/demo";
import { App } from "./App";

async function main() {
  await seedDemoIfRequested();
  createRoot(document.getElementById("root")!).render(<App />);
}

void main();
