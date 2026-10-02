import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Placeholder ID for local testing; pick a permanent one before publishing to the Play Store.
  appId: 'com.sikancil.dev',
  appName: 'Si Kancil',
  webDir: 'dist',
  android: {
    backgroundColor: '#1b1210',
  },
};

export default config;
