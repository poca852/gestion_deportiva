import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestiondeportiva.app',
  appName: 'Gestion Deportiva',
  webDir: 'www',
  plugins: {
    Keyboard: {
      resize: 'none',
      style: 'dark',
    },
  },
};

export default config;
