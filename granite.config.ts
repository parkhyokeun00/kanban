import { defineConfig } from '@apps-in-toss/web-framework/config';

const appHost = process.env.APP_HOST ?? 'localhost';

export default defineConfig({
  appName: 'todaystep',
  brand: {
    displayName: 'TodayStep',
    primaryColor: '#e43d12',
    icon: './converted-600x600.png'
  },
  permissions: [],
  outdir: 'dist',
  web: {
    host: appHost,
    port: 5173,
    commands: {
      dev: 'npm run web:dev',
      build: 'npm run web:build'
    }
  }
});
