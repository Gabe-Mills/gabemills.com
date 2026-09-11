import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root: __dirname, base:'/support/', plugins:[react()], build:{outDir:'dist',emptyOutDir:true}, server:{host:'127.0.0.1',port:4174}});
