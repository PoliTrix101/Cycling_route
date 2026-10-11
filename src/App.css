
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap");

/* =========================================
   CYCLETRACK — PREMIUM CYCLING DASHBOARD
   Dark navy + lime green
   Mobile-first responsive layout
========================================= */

:root {
  font-family: "DM Sans", sans-serif;
  color: #f5f8f5;
  background: #101820;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  --bg: #101820;
  --bg-raised: #141f28;
  --surface: #192630;
  --surface-raised: #21323d;
  --surface-hover: #293b46;

  --lime: #c7f464;
  --lime-bright: #d8ff8d;
  --lime-soft: rgba(199, 244, 100, 0.11);
  --lime-border: rgba(199, 244, 100, 0.25);

  --text: #f5f8f5;
  --muted: #94a5ae;
  --muted-dark: #687c87;

  --border: rgba(255, 255, 255, 0.085);
  --danger: #ff9999;
  --danger-soft: rgba(255, 117, 117, 0.1);

  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-xl: 28px;

  --shadow-sm: 0 6px 18px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 14px 36px rgba(0, 0, 0, 0.19);
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  min-height: 100%;
  scroll-behavior: smooth;
  background: var(--bg);
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(
      ellipse at 50% -20%,
      rgba(199, 244, 100, 0.065),
      transparent 48%
    ),
    var(--bg);
  color: var(--text);
}

body,
button,
input,
select,
textarea {
  font-family: "DM Sans", sans-serif;
}

button,
input,
select,
textarea {
  font-size: inherit;
}

button {
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
a:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 3px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

a {
  color: var(--lime);
  text-decoration: none;
}

a:hover {
  color: var(--lime-bright);
}

#root {
  min-height: 100vh;
}

/* =========================================
   APP SHELL
========================================= */

.app {
  position: relative;
  width: 100%;
  max-width: 1600px;
  min-height: 100vh;
  margin: 0 auto;
  padding-bottom: 84px;
}

.app-main {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 23px 16px 30px;
}

/* =========================================
   HEADER
========================================= */

.app-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 73px;
  padding: 14px 17px;
  border-bottom: 1px solid var(--border);
  background: rgba(16, 24, 32, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.brand-mark {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 14px;
  background: var(--lime);
  color: #152018;
  box-shadow: 0 5px 18px rgba(199, 244, 100, 0.12);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.brand-copy strong {
  font-family: "Space Grotesk", sans-serif;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.7px;
}

.brand-copy small {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 9px;
}

.gps-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.025);
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.45px;
  white-space: nowrap;
}

.gps-dot,
.ready-dot,
.recording-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--lime);
}

.gps-active {
  border-color: var(--lime-border);
  background: var(--lime-soft);
  color: var(--lime);
}

.gps-active .gps-dot,
.recording-dot {
  animation: cycle-pulse 1.7s infinite;
}

.avatar-button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface);
  color: var(--lime);
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.avatar-button:hover {
  border-color: var(--lime-border);
  background: var(--surface-hover);
}

/* =========================================
   STATUS MESSAGES
========================================= */

.message-bar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 12px 16px 0;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.6;
  animation: screen-in 180ms ease both;
}

.message-bar > svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.message-bar > span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.message-bar > button {
  flex-shrink: 0;
  padding: 0 3px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 21px;
  line-height: 1;
  cursor: pointer;
}

.message-error {
  border-color: rgba(255, 117, 117, 0.25);
  background: rgba(255, 117, 117, 0.08);
  color: #ffaaaa;
}

.message-success {
  border-color: var(--lime-border);
  background: var(--lime-soft);
  color: var(--lime);
}

/* =========================================
   SHARED TYPOGRAPHY
========================================= */

.section-kicker {
  margin: 0 0 9px;
  color: var(--lime);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.7px;
  line-height: 1.5;
}

.map-heading h1,
.content-screen h1 {
  margin: 0;
  font-family: "Space Grotesk", sans-serif;
  font-size: clamp(29px, 7vw, 40px);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -1.5px;
  overflow-wrap: anywhere;
}

.heading-subtitle {
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.map-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 13px;
  margin-bottom: 0;
}

.map-heading > div:first-child {
  min-width: 0;
}

.weather-placeholder {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
  color: var(--lime);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* =========================================
   MAP SCREEN
========================================= */

.map-screen {
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: screen-in 220ms ease both;
}

.map-stage {
  position: relative;
  width: 100%;
  height: 330px;
  min-height: 270px;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: #263d43;
  box-shadow: var(--shadow-md);
}

.cycling-map {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.cycling-map.leaflet-container {
  width: 100%;
  height: 100%;
  background: #dfe7d9;
  color: #1a2730;
  font-family: "DM Sans", sans-serif;
}

.cycling-map .leaflet-control-zoom {
  overflow: hidden;
  border: 0 !important;
  border-radius: 12px !important;
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.2) !important;
}

.cycling-map .leaflet-control-zoom a {
  width: 36px !important;
  height: 36px !important;
  border-bottom-color: rgba(255, 255, 255, 0.12) !important;
  background: #18252d !important;
  color: #fff !important;
  line-height: 36px !important;
}

.cycling-map .leaflet-control-zoom a:hover {
  background: #293b46 !important;
  color: var(--lime) !important;
}

.cycling-map .leaflet-control-attribution {
  max-width: 85%;
  background: rgba(255, 255, 255, 0.82);
  font-size: 9px;
}

.cycling-map .leaflet-popup-content-wrapper,
.cycling-map .leaflet-popup-tip {
  background: #18252d;
  color: #fff;
}

.cycling-map .leaflet-popup-content {
  font-family: "DM Sans", sans-serif;
}

.cycling-map .leaflet-popup-close-button {
  color: #fff !important;
}

/* Floating map controls */

.map-overlay-top {
  position: absolute;
  top: 13px;
  right: 13px;
  left: 13px;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
}

.map-tag,
.map-float-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 12px;
  background: rgba(16, 24, 32, 0.94);
  color: #fff;
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.18);
}

.map-tag {
  max-width: calc(100% - 54px);
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.75px;
}

.map-tag-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--lime);
  box-shadow: 0 0 10px rgba(199, 244, 100, 0.4);
}

.map-float-button {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  pointer-events: auto;
  cursor: pointer;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.map-float-button:hover {
  background: #253742;
  color: var(--lime);
}

.map-hint {
  position: absolute;
  bottom: 13px;
  left: 50%;
  z-index: 450;
  display: flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: calc(100% - 26px);
  padding: 10px 13px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 99px;
  background: rgba(16, 24, 32, 0.94);
  color: #fff;
  font-size: 10px;
  line-height: 1.5;
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.15);
  transform: translateX(-50%);
}

.map-hint svg {
  flex-shrink: 0;
  color: var(--lime);
}

/* =========================================
   PREMIUM RIDE CARD
========================================= */

.ride-card {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(
      circle at 100% 0,
      rgba(199, 244, 100, 0.085),
      transparent 43%
    ),
    linear-gradient(145deg, #1d2b35 0%, #17232c 100%);
  box-shadow: var(--shadow-md);
}

.ride-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
}

.ride-state-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.2px;
}

.ride-card-top h2 {
  margin: 0;
  font-family: "Space Grotesk", sans-serif;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.8px;
}

.ride-icon {
  display: grid;
  width: 49px;
  height: 49px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid rgba(199, 244, 100, 0.1);
  border-radius: 16px;
  background: var(--lime-soft);
  color: var(--lime);
}

/* =========================================
   LIVE RIDE METRICS
========================================= */

.live-stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  margin: 23px 0;
}

.live-stat {
  min-width: 0;
}

.live-stat > span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.3px;
  line-height: 1.5;
}

.live-stat > span svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--lime);
}

.live-stat > strong {
  display: block;
  margin-top: 9px;
  color: var(--text);
  font-family: "Space Grotesk", sans-serif;
  font-size: clamp(18px, 5vw, 27px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.8px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.live-stat > strong small {
  color: var(--muted);
  font-family: "DM Sans", sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
}

.live-stat .duration-number {
  font-size: clamp(16px, 4vw, 22px);
  letter-spacing: -0.6px;
}

.stat-separator {
  width: 1px;
  height: 43px;
  background: var(--border);
}

/* =========================================
   PRIMARY AND SECONDARY BUTTONS
========================================= */

.start-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 55px;
  padding: 14px 18px;
  border: 0;
  border-radius: 16px;
  background: var(--lime);
  color: #152018;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.4px;
  cursor: pointer;
  box-shadow: 0 7px 23px rgba(199, 244, 100, 0.1);
  transition:
    background 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.start-button:hover:not(:disabled) {
  background: var(--lime-bright);
  box-shadow: 0 9px 27px rgba(199, 244, 100, 0.18);
  transform: translateY(-1px);
}

.start-button:active:not(:disabled) {
  transform: scale(0.985);
}

.start-icon {
  display: grid;
  place-items: center;
}

.start-icon svg {
  width: 19px;
  height: 19px;
}

.active-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.waypoint-button,
.stop-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 51px;
  padding: 11px 9px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.waypoint-button {
  background: var(--surface-raised);
  color: var(--text);
}

.waypoint-button:hover {
  border-color: var(--lime-border);
  background: var(--surface-hover);
}

.stop-button {
  border-color: rgba(255, 117, 117, 0.23);
  background: var(--danger-soft);
  color: var(--danger);
}

.stop-button:hover:not(:disabled) {
  border-color: rgba(255, 117, 117, 0.45);
  background: rgba(255, 117, 117, 0.15);
}

.waypoint-button:active,
.stop-button:active {
  transform: scale(0.98);
}

.tracking-caption {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 15px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--lime);
  animation: cycle-pulse 1.7s infinite;
}

/* =========================================
   QUICK TIP
========================================= */

.quick-tip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.025);
  transition: border-color 160ms ease;
}

.quick-tip:hover {
  border-color: rgba(199, 244, 100, 0.16);
}

.tip-icon {
  display: grid;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid rgba(199, 244, 100, 0.09);
  border-radius: 14px;
  background: var(--lime-soft);
  color: var(--lime);
}

.quick-tip > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.quick-tip strong {
  font-size: 12px;
  font-weight: 700;
}

.quick-tip p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.65;
}

.quick-tip > svg {
  flex-shrink: 0;
  color: var(--muted);
}

/* =========================================
   CONTENT SCREENS
========================================= */

.content-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: screen-in 220ms ease both;
}

.content-screen h1 {
  margin-top: -5px;
}

.content-screen h2,
.content-screen h3 {
  font-family: "Space Grotesk", sans-serif;
  letter-spacing: -0.5px;
}

.content-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 9px;
}

.content-section-title h2 {
  margin: 0;
  font-size: 18px;
}

.back-link {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  width: fit-content;
  padding: 9px 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.back-link:hover {
  color: var(--lime);
}

.text-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface);
  color: var(--lime);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.text-action:hover:not(:disabled) {
  background: var(--surface-hover);
}

/* =========================================
   HISTORY SUMMARY
========================================= */

.history-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 5px 0 8px;
}

.history-summary > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 16px 14px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background:
    radial-gradient(
      circle at 100% 0,
      rgba(199, 244, 100, 0.055),
      transparent 60%
    ),
    var(--surface);
}

.history-summary > div > span {
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.7px;
  line-height: 1.5;
}

.history-summary > div > strong {
  color: var(--lime);
  font-family: "Space Grotesk", sans-serif;
  font-size: clamp(19px, 5vw, 26px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.8px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

/* =========================================
   HISTORY LIST
========================================= */

.ride-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: var(--surface);
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.history-card:hover {
  border-color: rgba(199, 244, 100, 0.19);
  background: #1c2a34;
}

.history-icon {
  display: grid;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 14px;
  background: var(--lime-soft);
  color: var(--lime);
}

.history-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.history-main > strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.history-main > span {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}

.history-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 13px;
  margin-top: 4px;
}

.history-metrics > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #d2dcde;
  font-size: 10px;
}

.history-metrics svg {
  color: var(--lime);
}

.history-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}

/* Allows Share and Export buttons to sit neatly together
   when the JSX groups the action buttons in a div. */

.history-actions > div {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.history-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 90px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.history-status.completed {
  border-color: var(--lime-border);
  background: var(--lime-soft);
  color: var(--lime);
}

.history-status.active,
.history-status.in_progress {
  border-color: rgba(255, 198, 100, 0.24);
  background: rgba(255, 198, 100, 0.08);
  color: #ffd18a;
}

.icon-action {
  display: grid;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface-raised);
  color: var(--lime);
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.icon-action:hover:not(:disabled) {
  border-color: var(--lime-border);
  background: var(--surface-hover);
}

.icon-action:active:not(:disabled) {
  transform: scale(0.95);
}

.icon-action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* =========================================
   EMPTY STATES
========================================= */

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  padding: 32px 20px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.018);
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.empty-card h3 {
  margin: 0;
  color: var(--text);
  font-size: 17px;
}

.empty-card p {
  max-width: 300px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.empty-icon {
  display: grid;
  width: 57px;
  height: 57px;
  margin-bottom: 4px;
  place-items: center;
  border: 1px solid var(--lime-border);
  border-radius: 18px;
  background: var(--lime-soft);
  color: var(--lime);
}

.small-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  margin-top: 7px;
  padding: 11px 16px;
  border: 0;
  border-radius: 12px;
  background: var(--lime);
  color: #152018;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.small-primary:hover:not(:disabled) {
  background: var(--lime-bright);
}

.small-primary:active:not(:disabled) {
  transform: scale(0.98);
}

/* =========================================
   SAVED PLACES
========================================= */

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.saved-card {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: var(--surface);
}

.saved-pin {
  display: grid;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 14px;
  background: var(--lime-soft);
  color: var(--lime);
}

.saved-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.saved-main strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}

.saved-main span {
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.saved-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.saved-note svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--lime);
}

/* =========================================
   PROFILE
========================================= */

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 18px;
  border: 1px solid var(--border);
  border-radius: 21px;
  background:
    radial-gradient(
      circle at 100% 0,
      rgba(199, 244, 100, 0.1),
      transparent 52%
    ),
    linear-gradient(145deg, #1d2b35, #17232c);
  box-shadow: var(--shadow-sm);
}

.profile-avatar {
  display: grid;
  width: 62px;
  height: 62px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--lime-border);
  border-radius: 20px;
  background: var(--lime-soft);
  color: var(--lime);
}

.profile-card h2 {
  margin: 0;
  font-family: "Space Grotesk", sans-serif;
  font-size: 22px;
}

.profile-card p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.profile-section-title {
  margin-top: 5px;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.profile-stats > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  min-height: 137px;
  padding: 16px 14px;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: var(--surface);
}

.profile-stat-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  background: var(--lime-soft);
  color: var(--lime);
}

.profile-stats strong {
  color: var(--text);
  font-family: "Space Grotesk", sans-serif;
  font-size: clamp(17px, 4.6vw, 23px);
  font-weight: 700;
  letter-spacing: -0.7px;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.profile-stats > div > span:last-child {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

.profile-note {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 15px;
  border: 1px solid var(--lime-border);
  border-radius: 16px;
  background: rgba(199, 244, 100, 0.055);
}

.profile-note > svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--lime);
}

.profile-note strong {
  font-size: 12px;
}

.profile-note p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}

/* =========================================
   BOTTOM NAVIGATION
========================================= */

.bottom-nav {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1100;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 8px 11px max(10px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: rgba(16, 24, 32, 0.96);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.nav-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 51px;
  padding: 7px 3px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.nav-button > span {
  display: grid;
  place-items: center;
}

.nav-button svg {
  width: 21px;
  height: 21px;
  stroke-width: 1.8;
}

.nav-button small {
  font-size: 10px;
  font-weight: 700;
}

.nav-button:hover {
  color: var(--lime);
}

.nav-button.selected {
  background: var(--lime-soft);
  color: var(--lime);
}

.nav-button.selected svg {
  stroke-width: 2.3;
}

/* =========================================
   WAYPOINT MODAL
========================================= */

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  overflow-y: auto;
  background: rgba(3, 8, 12, 0.77);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  animation: fade-in 160ms ease both;
}

.waypoint-modal {
  position: relative;
  width: 100%;
  max-width: 510px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 12px 21px max(25px, env(safe-area-inset-bottom));
  border: 1px solid var(--border);
  border-radius: 25px 25px 0 0;
  background:
    radial-gradient(
      circle at 100% 0,
      rgba(199, 244, 100, 0.06),
      transparent 45%
    ),
    #18242d;
  box-shadow: 0 -12px 50px rgba(0, 0, 0, 0.3);
  animation: modal-in 220ms ease both;
}

.modal-grabber {
  width: 42px;
  height: 4px;
  margin: 0 auto 23px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.2);
}

.modal-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 23px;
}

.modal-pin {
  display: grid;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--lime-border);
  border-radius: 15px;
  background: var(--lime-soft);
  color: var(--lime);
}

.modal-heading h2 {
  margin: 0;
  font-family: "Space Grotesk", sans-serif;
  font-size: 22px;
  letter-spacing: -0.6px;
}

.modal-heading p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.waypoint-modal > label {
  display: block;
  margin-bottom: 9px;
  color: #dce5e8;
  font-size: 12px;
  font-weight: 700;
}

.waypoint-modal > input {
  display: block;
  width: 100%;
  min-height: 49px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 13px;
  outline: none;
  background: #111d25;
  color: var(--text);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.waypoint-modal > input::placeholder {
  color: var(--muted-dark);
}

.waypoint-modal > input:focus {
  border-color: var(--lime-border);
  box-shadow: 0 0 0 3px rgba(199, 244, 100, 0.07);
}

.modal-coordinates {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 12px 0 21px;
  color: var(--muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.modal-coordinates svg {
  flex-shrink: 0;
  color: var(--lime);
}

.modal-cancel {
  display: block;
  width: 100%;
  min-height: 45px;
  margin-top: 9px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.modal-cancel:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
}

/* =========================================
   LOADING ICON
========================================= */

.spin-icon {
  animation: cycle-spin 1s linear infinite;
}

/* =========================================
   ANIMATIONS
========================================= */

@keyframes cycle-pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(199, 244, 100, 0.3);
  }

  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 5px rgba(199, 244, 100, 0);
  }
}

@keyframes cycle-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes screen-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* =========================================
   SMALL PHONES
========================================= */

@media (max-width: 380px) {
  .app-header {
    gap: 7px;
    padding-right: 11px;
    padding-left: 11px;
  }

  .brand {
    gap: 7px;
  }

  .brand-mark {
    width: 37px;
    height: 37px;
    border-radius: 12px;
  }

  .brand-mark svg {
    width: 20px;
    height: 20px;
  }

  .brand-copy strong {
    font-size: 16px;
  }

  .brand-copy small {
    font-size: 8px;
    letter-spacing: 1px;
  }

  .header-right {
    gap: 6px;
  }

  .gps-chip {
    gap: 5px;
    padding: 7px;
    font-size: 8px;
  }

  .avatar-button {
    width: 35px;
    height: 35px;
  }

  .app-main {
    padding-right: 12px;
    padding-left: 12px;
  }

  .map-stage {
    height: 285px;
  }

  .ride-card {
    padding: 16px;
  }

  .live-stats {
    gap: 7px;
  }

  .live-stat > span {
    gap: 4px;
    font-size: 7px;
  }

  .live-stat > span svg {
    width: 12px;
    height: 12px;
  }

  .live-stat > strong {
    font-size: 17px;
  }

  .live-stat .duration-number {
    font-size: 15px;
  }

  .stat-separator {
    height: 36px;
  }

  .history-card {
    gap: 9px;
    padding: 12px;
  }

  .history-icon {
    width: 37px;
    height: 37px;
  }

  .history-actions {
    max-width: 82px;
  }

  .history-status {
    max-width: 82px;
    font-size: 8px;
  }

  .history-actions .icon-action {
    width: 32px;
    height: 32px;
  }
}

/* =========================================
   TABLET
========================================= */

@media (min-width: 600px) {
  .app {
    padding-bottom: 96px;
  }

  .app-header {
    min-height: 78px;
    padding: 17px 25px;
  }

  .app-main {
    padding: 29px 24px 38px;
  }

  .map-heading {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .map-heading > div:first-child {
    flex: 1;
  }

  .map-stage {
    height: 400px;
  }

  .ride-card {
    padding: 24px;
  }

  .live-stats {
    gap: 15px;
  }

  .live-stat > span {
    font-size: 10px;
  }

  .live-stat > strong {
    font-size: 26px;
  }

  .live-stat .duration-number {
    font-size: 22px;
  }

  .history-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 13px;
  }

  .history-summary > div {
    padding: 19px 16px;
  }

  .profile-stats {
    gap: 14px;
  }

  .profile-stats > div {
    min-height: 150px;
    padding: 19px;
  }

  .bottom-nav {
    right: auto;
    bottom: 16px;
    left: 50%;
    width: min(470px, calc(100% - 32px));
    padding: 9px;
    border: 1px solid var(--border);
    border-radius: 21px;
    box-shadow: 0 12px 38px rgba(0, 0, 0, 0.3);
    transform: translateX(-50%);
  }

  .nav-button {
    min-height: 54px;
  }

  .modal-backdrop {
    align-items: center;
    padding: 24px;
  }

  .waypoint-modal {
    padding: 18px 27px 27px;
    border-radius: 25px;
  }

  .modal-grabber {
    margin-bottom: 22px;
  }
}

/* =========================================
   DESKTOP
========================================= */

@media (min-width: 900px) {
  .app {
    padding-bottom: 25px;
  }

  .app-header {
    padding-right: max(30px, calc((100% - 1100px) / 2));
    padding-left: max(30px, calc((100% - 1100px) / 2));
  }

  .app-main {
    padding: 35px 30px 45px;
  }

  .map-screen {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.85fr);
    align-items: start;
    gap: 22px;
  }

  .map-heading {
    grid-column: 1 / -1;
    margin-bottom: 0;
  }

  .map-stage {
    height: min(56vw, 540px);
    min-height: 420px;
  }

  .ride-card {
    align-self: start;
    padding: 25px;
  }

  .live-stats {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    margin: 21px 0;
  }

  .live-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 15px 0;
    border-bottom: 1px solid var(--border);
  }

  .live-stat:first-child {
    padding-top: 0;
  }

  .live-stat > span {
    font-size: 10px;
  }

  .live-stat > strong {
    margin-top: 0;
    text-align: right;
    font-size: 24px;
  }

  .live-stat .duration-number {
    font-size: 22px;
  }

  .stat-separator {
    display: none;
  }

  .quick-tip {
    grid-column: 1 / -1;
  }

  .content-screen {
    max-width: 900px;
    margin: 0 auto;
    gap: 19px;
  }

  .history-card {
    padding: 18px;
  }

  .profile-card {
    padding: 28px;
  }

  .profile-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .bottom-nav {
    position: static;
    display: flex;
    justify-content: center;
    width: fit-content;
    max-width: calc(100% - 40px);
    margin: 22px auto;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: none;
    transform: none;
  }

  .nav-button {
    flex-direction: row;
    gap: 9px;
    min-width: 105px;
    padding: 10px 17px;
  }

  .nav-button small {
    font-size: 11px;
  }
}

/* =========================================
   REDUCED MOTION
========================================= */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
