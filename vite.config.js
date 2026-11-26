import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

/**
 * Ebben a projektben minden fajl egy szinten, a gyokerben van (nincsenek
 * mappak), mert a GitHub webes feltoltoje csak igy tudja fogadni oket.
 * Ez a kis kiegeszites gondoskodik rolla, hogy a kepek, az ikonok, a
 * manifest es a service worker a kesz oldalon a helyukre keruljenek.
 */
const gyokerFajlokMasolasa = () => ({
  name: "gyoker-fajlok-masolasa",
  generateBundle() {
    const gyokerbe = [
      "manifest.json",
      "sw.js",
      "razar-logo.jpg",
      "razar-wordmark.jpg",
      "razar-rz.jpg",
    ];
    const ikonok = ["icon-192.png", "icon-512.png", "apple-touch-icon.png"];

    for (const f of gyokerbe) {
      if (fs.existsSync(f)) {
        this.emitFile({ type: "asset", fileName: f, source: fs.readFileSync(f) });
      }
    }
    for (const f of ikonok) {
      if (fs.existsSync(f)) {
        this.emitFile({ type: "asset", fileName: `icons/${f}`, source: fs.readFileSync(f) });
      }
    }
  },
});

export default defineConfig({
  plugins: [react(), gyokerFajlokMasolasa()],
  publicDir: false,
});
