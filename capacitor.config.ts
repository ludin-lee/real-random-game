import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bloomblocks.puzzle',
  appName: 'Bloom Blocks',
  webDir: 'dist',
  backgroundColor: '#1d1640',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
};

export default config;
