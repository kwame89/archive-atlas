import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  // nodePolyfills: @stellar/stellar-sdk expects Node's Buffer, which the
  // browser doesn't have — needed for client-side wallet-linked signing.
  plugins: [react(), nodePolyfills()],
})
