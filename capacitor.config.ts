import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cycletrack.app",
  appName: "CycleTrack",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
