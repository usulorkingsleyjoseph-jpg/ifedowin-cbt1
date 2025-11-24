import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // *** THIS LINE TELLS VITE TO USE RELATIVE PATHS FOR DEPLOYMENT ***
  base: './', 
  plugins: [react()],
})