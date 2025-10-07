'use client'

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';

// Dados de exemplo (mesmo do retorno-carteira.json)
const retornoData = [
  { date: "01-jan", tatica: 0, ifix: 0, cdi: 0 },
  { date: "02-jan", tatica: 0.5, ifix: 0.2, cdi: 0.1 },
  { date: "03-jan", tatica: 1.2, ifix: 0.4, cdi: 0.2 },
  { date: "04-jan", tatica: 0.8, ifix: 0.3, cdi: 0.15 },
  { date: "05-jan", tatica: 2.1, ifix: 0.6, cdi: 0.25 },
  { date: "08-jan", tatica: 1.8, ifix: 0.5, cdi: 0.3 },
  { date: "09-jan", tatica: 2.5, ifix: 0.7, cdi: 0.35 },
  { date: "10-jan", tatica: 3.2, ifix: 0.9, cdi: 0.4 },
  { date: "11-jan", tatica: 2.8, ifix: 0.8, cdi: 0.45 },
  { date: "12-jan", tatica: 4.1, ifix: 1.1, cdi: 0.5 },
  { date: "15-jan", tatica: 3.9, ifix: 1.0, cdi: 0.55 },
  { date: "16-jan", tatica: 5.2, ifix: 1.3, cdi: 0.6 },
  { date: "17-jan", tatica: 4.8, ifix: 1.2, cdi: 0.65 },
  { date: "18-jan", tatica: 6.1, ifix: 1.5, cdi: 0.7 },
  { date: "19-jan", tatica: 5.7, ifix: 1.4, cdi: 0.75 },
  { date: "22-jan", tatica: 7.2, ifix: 1.7, cdi: 0.8 },
  { date: "23-jan", tatica: 6.8, ifix: 1.6, cdi: 0.85 },
  { date: "24-jan", tatica: 8.1, ifix: 1.9, cdi: 0.9 },
  { date: "25-jan", tatica: 7.7, ifix: 1.8, cdi: 0.95 },
  { date: "26-jan", tatica: 9.2, ifix: 2.1, cdi: 1.0 },
  { date: "29-jan", tatica: 8.8, ifix: 2.0, cdi: 1.05 },
  { date: "30-jan", tatica: 10.1, ifix: 2.3, cdi: 1.1 },
  { date: "31-jan", tatica: 9.7, ifix: 2.2, cdi: 1.15 },
  { date: "01-fev", tatica: 11.2, ifix: 2.5, cdi: 1.2 },
  { date: "02-fev", tatica: 10.8, ifix: 2.4, cdi: 1.25 },
  { date: "05-fev", tatica: 12.1, ifix: 2.7, cdi: 1.3 },
  { date: "06-fev", tatica: 11.7, ifix: 2.6, cdi: 1.35 },
  { date: "07-fev", tatica: 13.2, ifix: 2.9, cdi: 1.4 },
  { date: "08-fev", tatica: 12.8, ifix: 2.8, cdi: 1.45 },
  { date: "09-fev", tatica: 14.1, ifix: 3.1, cdi: 1.5 },
  { date: "12-fev", tatica: 13.7, ifix: 3.0, cdi: 1.55 },
  { date: "13-fev", tatica: 15.2, ifix: 3.3, cdi: 1.6 },
  { date: "14-fev", tatica: 14.8, ifix: 3.2, cdi: 1.65 },
  { date: "15-fev", tatica: 16.1, ifix: 3.5, cdi: 1.7 },
  { date: "16-fev", tatica: 15.7, ifix: 3.4, cdi: 1.75 },
  { date: "19-fev", tatica: 17.2, ifix: 3.7, cdi: 1.8 },
  { date: "20-fev", tatica: 16.8, ifix: 3.6, cdi: 1.85 },
  { date: "21-fev", tatica: 18.1, ifix: 3.9, cdi: 1.9 },
  { date: "22-fev", tatica: 17.7, ifix: 3.8, cdi: 1.95 },
  { date: "23-fev", tatica: 19.2, ifix: 4.1, cdi: 2.0 },
  { date: "26-fev", tatica: 18.8, ifix: 4.0, cdi: 2.05 },
  { date: "27-fev", tatica: 20.1, ifix: 4.3, cdi: 2.1 },
  { date: "28-fev", tatica: 19.7, ifix: 4.2, cdi: 2.15 },
  { date: "01-mar", tatica: 21.2, ifix: 4.5, cdi: 2.2 },
  { date: "02-mar", tatica: 20.8, ifix: 4.4, cdi: 2.25 },
  { date: "05-mar", tatica: 22.1, ifix: 4.7, cdi: 2.3 },
  { date: "06-mar", tatica: 21.7, ifix: 4.6, cdi: 2.35 },
  { date: "07-mar", tatica: 23.2, ifix: 4.9, cdi: 2.4 },
  { date: "08-mar", tatica: 22.8, ifix: 4.8, cdi: 2.45 },
  { date: "09-mar", tatica: 24.1, ifix: 5.1, cdi: 2.5 },
  { date: "12-mar", tatica: 23.7, ifix: 5.0, cdi: 2.55 },
  { date: "13-mar", tatica: 25.2, ifix: 5.3, cdi: 2.6 },
  { date: "14-mar", tatica: 24.8, ifix: 5.2, cdi: 2.65 },
  { date: "15-mar", tatica: 26.1, ifix: 5.5, cdi: 2.7 },
  { date: "16-mar", tatica: 25.7, ifix: 5.4, cdi: 2.75 },
  { date: "19-mar", tatica: 27.2, ifix: 5.7, cdi: 2.8 },
  { date: "20-mar", tatica: 26.8, ifix: 5.6, cdi: 2.85 },
  { date: "21-mar", tatica: 28.1, ifix: 5.9, cdi: 2.9 },
  { date: "22-mar", tatica: 27.7, ifix: 5.8, cdi: 2.95 },
  { date: "23-mar", tatica: 29.2, ifix: 6.1, cdi: 3.0 },
  { date: "26-mar", tatica: 28.8, ifix: 6.0, cdi: 3.05 },
  { date: "27-mar", tatica: 30.1, ifix: 6.3, cdi: 3.1 },
  { date: "28-mar", tatica: 29.7, ifix: 6.2, cdi: 3.15 },
  { date: "29-mar", tatica: 31.2, ifix: 6.5, cdi: 3.2 },
  { date: "30-mar", tatica: 30.8, ifix: 6.4, cdi: 3.25 },
  { date: "02-abr", tatica: 32.1, ifix: 6.7, cdi: 3.3 },
  { date: "03-abr", tatica: 31.7, ifix: 6.6, cdi: 3.35 },
  { date: "04-abr", tatica: 33.2, ifix: 6.9, cdi: 3.4 },
  { date: "05-abr", tatica: 32.8, ifix: 6.8, cdi: 3.45 },
  { date: "08-abr", tatica: 34.1, ifix: 7.1, cdi: 3.5 },
  { date: "09-abr", tatica: 33.7, ifix: 7.0, cdi: 3.55 },
  { date: "10-abr", tatica: 35.2, ifix: 7.3, cdi: 3.6 },
  { date: "11-abr", tatica: 34.8, ifix: 7.2, cdi: 3.65 },
  { date: "12-abr", tatica: 36.1, ifix: 7.5, cdi: 3.7 },
  { date: "15-abr", tatica: 35.7, ifix: 7.4, cdi: 3.75 },
  { date: "16-abr", tatica: 37.2, ifix: 7.7, cdi: 3.8 },
  { date: "17-abr", tatica: 36.8, ifix: 7.6, cdi: 3.85 },
  { date: "18-abr", tatica: 38.1, ifix: 7.9, cdi: 3.9 },
  { date: "19-abr", tatica: 37.7, ifix: 7.8, cdi: 3.95 },
  { date: "22-abr", tatica: 39.2, ifix: 8.1, cdi: 4.0 },
  { date: "23-abr", tatica: 38.8, ifix: 8.0, cdi: 4.05 },
  { date: "24-abr", tatica: 40.1, ifix: 8.3, cdi: 4.1 },
  { date: "25-abr", tatica: 39.7, ifix: 8.2, cdi: 4.15 },
  { date: "26-abr", tatica: 41.2, ifix: 8.5, cdi: 4.2 },
  { date: "29-abr", tatica: 40.8, ifix: 8.4, cdi: 4.25 },
  { date: "30-abr", tatica: 42.1, ifix: 8.7, cdi: 4.3 },
  { date: "01-mai", tatica: 41.7, ifix: 8.6, cdi: 4.35 },
  { date: "02-mai", tatica: 43.2, ifix: 8.9, cdi: 4.4 },
  { date: "03-mai", tatica: 42.8, ifix: 8.8, cdi: 4.45 },
  { date: "06-mai", tatica: 44.1, ifix: 9.1, cdi: 4.5 },
  { date: "07-mai", tatica: 43.7, ifix: 9.0, cdi: 4.55 },
  { date: "08-mai", tatica: 45.2, ifix: 9.3, cdi: 4.6 },
  { date: "09-mai", tatica: 44.8, ifix: 9.2, cdi: 4.65 },
  { date: "10-mai", tatica: 46.1, ifix: 9.5, cdi: 4.7 },
  { date: "13-mai", tatica: 45.7, ifix: 9.4, cdi: 4.75 },
  { date: "14-mai", tatica: 47.2, ifix: 9.7, cdi: 4.8 },
  { date: "15-mai", tatica: 46.8, ifix: 9.6, cdi: 4.85 },
  { date: "16-mai", tatica: 48.1, ifix: 9.9, cdi: 4.9 },
  { date: "17-mai", tatica: 47.7, ifix: 9.8, cdi: 4.95 },
  { date: "20-mai", tatica: 49.2, ifix: 10.1, cdi: 5.0 },
  { date: "21-mai", tatica: 48.8, ifix: 10.0, cdi: 5.05 },
  { date: "22-mai", tatica: 50.1, ifix: 10.3, cdi: 5.1 },
  { date: "23-mai", tatica: 49.7, ifix: 10.2, cdi: 5.15 },
  { date: "24-mai", tatica: 51.2, ifix: 10.5, cdi: 5.2 },
  { date: "27-mai", tatica: 50.8, ifix: 10.4, cdi: 5.25 },
  { date: "28-mai", tatica: 52.1, ifix: 10.7, cdi: 5.3 },
  { date: "29-mai", tatica: 51.7, ifix: 10.6, cdi: 5.35 },
  { date: "30-mai", tatica: 53.2, ifix: 10.9, cdi: 5.4 },
  { date: "31-mai", tatica: 52.8, ifix: 10.8, cdi: 5.45 },
  { date: "03-jun", tatica: 54.1, ifix: 11.1, cdi: 5.5 },
  { date: "04-jun", tatica: 53.7, ifix: 11.0, cdi: 5.55 },
  { date: "05-jun", tatica: 55.2, ifix: 11.3, cdi: 5.6 },
  { date: "06-jun", tatica: 54.8, ifix: 11.2, cdi: 5.65 },
  { date: "07-jun", tatica: 56.1, ifix: 11.5, cdi: 5.7 },
  { date: "10-jun", tatica: 55.7, ifix: 11.4, cdi: 5.75 },
  { date: "11-jun", tatica: 57.2, ifix: 11.7, cdi: 5.8 },
  { date: "12-jun", tatica: 56.8, ifix: 11.6, cdi: 5.85 },
  { date: "13-jun", tatica: 58.1, ifix: 11.9, cdi: 5.9 },
  { date: "14-jun", tatica: 57.7, ifix: 11.8, cdi: 5.95 },
  { date: "17-jun", tatica: 59.2, ifix: 12.1, cdi: 6.0 },
  { date: "18-jun", tatica: 58.8, ifix: 12.0, cdi: 6.05 },
  { date: "19-jun", tatica: 60.1, ifix: 12.3, cdi: 6.1 },
  { date: "20-jun", tatica: 59.7, ifix: 12.2, cdi: 6.15 },
  { date: "21-jun", tatica: 61.2, ifix: 12.5, cdi: 6.2 },
  { date: "24-jun", tatica: 60.8, ifix: 12.4, cdi: 6.25 },
  { date: "25-jun", tatica: 62.1, ifix: 12.7, cdi: 6.3 },
  { date: "26-jun", tatica: 61.7, ifix: 12.6, cdi: 6.35 },
  { date: "27-jun", tatica: 63.2, ifix: 12.9, cdi: 6.4 },
  { date: "28-jun", tatica: 62.8, ifix: 12.8, cdi: 6.45 },
  { date: "01-jul", tatica: 64.1, ifix: 13.1, cdi: 6.5 },
  { date: "02-jul", tatica: 63.7, ifix: 13.0, cdi: 6.55 },
  { date: "03-jul", tatica: 65.2, ifix: 13.3, cdi: 6.6 },
  { date: "04-jul", tatica: 64.8, ifix: 13.2, cdi: 6.65 },
  { date: "05-jul", tatica: 66.1, ifix: 13.5, cdi: 6.7 },
  { date: "08-jul", tatica: 65.7, ifix: 13.4, cdi: 6.75 },
  { date: "09-jul", tatica: 67.2, ifix: 13.7, cdi: 6.8 },
  { date: "10-jul", tatica: 66.8, ifix: 13.6, cdi: 6.85 },
  { date: "11-jul", tatica: 68.1, ifix: 13.9, cdi: 6.9 },
  { date: "12-jul", tatica: 67.7, ifix: 13.8, cdi: 6.95 },
  { date: "15-jul", tatica: 69.2, ifix: 14.1, cdi: 7.0 },
  { date: "16-jul", tatica: 68.8, ifix: 14.0, cdi: 7.05 },
  { date: "17-jul", tatica: 70.1, ifix: 14.3, cdi: 7.1 },
  { date: "18-jul", tatica: 69.7, ifix: 14.2, cdi: 7.15 },
  { date: "19-jul", tatica: 71.2, ifix: 14.5, cdi: 7.2 },
  { date: "22-jul", tatica: 70.8, ifix: 14.4, cdi: 7.25 },
  { date: "23-jul", tatica: 72.1, ifix: 14.7, cdi: 7.3 },
  { date: "24-jul", tatica: 71.7, ifix: 14.6, cdi: 7.35 },
  { date: "25-jul", tatica: 73.2, ifix: 14.9, cdi: 7.4 },
  { date: "26-jul", tatica: 72.8, ifix: 14.8, cdi: 7.45 },
  { date: "29-jul", tatica: 74.1, ifix: 15.1, cdi: 7.5 },
  { date: "30-jul", tatica: 73.7, ifix: 15.0, cdi: 7.55 },
  { date: "31-jul", tatica: 75.2, ifix: 15.3, cdi: 7.6 },
  { date: "01-ago", tatica: 74.8, ifix: 15.2, cdi: 7.65 },
  { date: "02-ago", tatica: 76.1, ifix: 15.5, cdi: 7.7 },
  { date: "05-ago", tatica: 75.7, ifix: 15.4, cdi: 7.75 },
  { date: "06-ago", tatica: 77.2, ifix: 15.7, cdi: 7.8 },
  { date: "07-ago", tatica: 76.8, ifix: 15.6, cdi: 7.85 },
  { date: "08-ago", tatica: 78.1, ifix: 15.9, cdi: 7.9 },
  { date: "09-ago", tatica: 77.7, ifix: 15.8, cdi: 7.95 },
  { date: "12-ago", tatica: 79.2, ifix: 16.1, cdi: 8.0 },
  { date: "13-ago", tatica: 78.8, ifix: 16.0, cdi: 8.05 },
  { date: "14-ago", tatica: 80.1, ifix: 16.3, cdi: 8.1 },
  { date: "15-ago", tatica: 79.7, ifix: 16.2, cdi: 8.15 },
  { date: "16-ago", tatica: 81.2, ifix: 16.5, cdi: 8.2 },
  { date: "19-ago", tatica: 80.8, ifix: 16.4, cdi: 8.25 },
  { date: "20-ago", tatica: 82.1, ifix: 16.7, cdi: 8.3 },
  { date: "21-ago", tatica: 81.7, ifix: 16.6, cdi: 8.35 },
  { date: "22-ago", tatica: 83.2, ifix: 16.9, cdi: 8.4 },
  { date: "23-ago", tatica: 82.8, ifix: 16.8, cdi: 8.45 },
  { date: "26-ago", tatica: 84.1, ifix: 17.1, cdi: 8.5 },
  { date: "27-ago", tatica: 83.7, ifix: 17.0, cdi: 8.55 },
  { date: "28-ago", tatica: 85.2, ifix: 17.3, cdi: 8.6 },
  { date: "29-ago", tatica: 84.8, ifix: 17.2, cdi: 8.65 },
  { date: "30-ago", tatica: 86.1, ifix: 17.5, cdi: 8.7 },
  { date: "02-set", tatica: 85.7, ifix: 17.4, cdi: 8.75 },
  { date: "03-set", tatica: 87.2, ifix: 17.7, cdi: 8.8 },
  { date: "04-set", tatica: 86.8, ifix: 17.6, cdi: 8.85 },
  { date: "05-set", tatica: 88.1, ifix: 17.9, cdi: 8.9 },
  { date: "06-set", tatica: 87.7, ifix: 17.8, cdi: 8.95 },
  { date: "09-set", tatica: 89.2, ifix: 18.1, cdi: 9.0 },
  { date: "10-set", tatica: 88.8, ifix: 18.0, cdi: 9.05 },
  { date: "11-set", tatica: 90.1, ifix: 18.3, cdi: 9.1 },
  { date: "12-set", tatica: 89.7, ifix: 18.2, cdi: 9.15 },
  { date: "13-set", tatica: 91.2, ifix: 18.5, cdi: 9.2 },
  { date: "16-set", tatica: 90.8, ifix: 18.4, cdi: 9.25 },
  { date: "17-set", tatica: 92.1, ifix: 18.7, cdi: 9.3 },
  { date: "18-set", tatica: 91.7, ifix: 18.6, cdi: 9.35 },
  { date: "19-set", tatica: 93.2, ifix: 18.9, cdi: 9.4 },
  { date: "20-set", tatica: 92.8, ifix: 18.8, cdi: 9.45 },
  { date: "23-set", tatica: 94.1, ifix: 19.1, cdi: 9.5 },
  { date: "24-set", tatica: 93.7, ifix: 19.0, cdi: 9.55 },
  { date: "25-set", tatica: 95.2, ifix: 19.3, cdi: 9.6 },
  { date: "26-set", tatica: 94.8, ifix: 19.2, cdi: 9.65 },
  { date: "27-set", tatica: 96.1, ifix: 19.5, cdi: 9.7 },
  { date: "30-set", tatica: 95.7, ifix: 19.4, cdi: 9.75 },
  { date: "01-out", tatica: 97.2, ifix: 19.7, cdi: 9.8 },
  { date: "02-out", tatica: 96.8, ifix: 19.6, cdi: 9.85 },
  { date: "03-out", tatica: 98.1, ifix: 19.9, cdi: 9.9 },
  { date: "04-out", tatica: 97.7, ifix: 19.8, cdi: 9.95 },
  { date: "07-out", tatica: 99.2, ifix: 20.1, cdi: 10.0 },
  { date: "08-out", tatica: 98.8, ifix: 20.0, cdi: 10.05 },
  { date: "09-out", tatica: 100.1, ifix: 20.3, cdi: 10.1 },
  { date: "10-out", tatica: 99.7, ifix: 20.2, cdi: 10.15 },
  { date: "11-out", tatica: 101.2, ifix: 20.5, cdi: 10.2 },
  { date: "14-out", tatica: 100.8, ifix: 20.4, cdi: 10.25 },
  { date: "15-out", tatica: 102.1, ifix: 20.7, cdi: 10.3 },
  { date: "16-out", tatica: 101.7, ifix: 20.6, cdi: 10.35 },
  { date: "17-out", tatica: 103.2, ifix: 20.9, cdi: 10.4 },
  { date: "18-out", tatica: 102.8, ifix: 20.8, cdi: 10.45 },
  { date: "21-out", tatica: 104.1, ifix: 21.1, cdi: 10.5 },
  { date: "22-out", tatica: 103.7, ifix: 21.0, cdi: 10.55 },
  { date: "23-out", tatica: 105.2, ifix: 21.3, cdi: 10.6 },
  { date: "24-out", tatica: 104.8, ifix: 21.2, cdi: 10.65 },
  { date: "25-out", tatica: 106.1, ifix: 21.5, cdi: 10.7 },
  { date: "28-out", tatica: 105.7, ifix: 21.4, cdi: 10.75 },
  { date: "29-out", tatica: 107.2, ifix: 21.7, cdi: 10.8 },
  { date: "30-out", tatica: 106.8, ifix: 21.6, cdi: 10.85 },
  { date: "31-out", tatica: 108.1, ifix: 21.9, cdi: 10.9 },
  { date: "01-nov", tatica: 107.7, ifix: 21.8, cdi: 10.95 },
  { date: "04-nov", tatica: 109.2, ifix: 22.1, cdi: 11.0 },
  { date: "05-nov", tatica: 108.8, ifix: 22.0, cdi: 11.05 },
  { date: "06-nov", tatica: 110.1, ifix: 22.3, cdi: 11.1 },
  { date: "07-nov", tatica: 109.7, ifix: 22.2, cdi: 11.15 },
  { date: "08-nov", tatica: 111.2, ifix: 22.5, cdi: 11.2 },
  { date: "11-nov", tatica: 110.8, ifix: 22.4, cdi: 11.25 },
  { date: "12-nov", tatica: 112.1, ifix: 22.7, cdi: 11.3 },
  { date: "13-nov", tatica: 111.7, ifix: 22.6, cdi: 11.35 },
  { date: "14-nov", tatica: 113.2, ifix: 22.9, cdi: 11.4 },
  { date: "15-nov", tatica: 112.8, ifix: 22.8, cdi: 11.45 },
  { date: "18-nov", tatica: 114.1, ifix: 23.1, cdi: 11.5 },
  { date: "19-nov", tatica: 113.7, ifix: 23.0, cdi: 11.55 },
  { date: "20-nov", tatica: 115.2, ifix: 23.3, cdi: 11.6 },
  { date: "21-nov", tatica: 114.8, ifix: 23.2, cdi: 11.65 },
  { date: "22-nov", tatica: 116.1, ifix: 23.5, cdi: 11.7 },
  { date: "25-nov", tatica: 115.7, ifix: 23.4, cdi: 11.75 },
  { date: "26-nov", tatica: 117.2, ifix: 23.7, cdi: 11.8 },
  { date: "27-nov", tatica: 116.8, ifix: 23.6, cdi: 11.85 },
  { date: "28-nov", tatica: 118.1, ifix: 23.9, cdi: 11.9 },
  { date: "29-nov", tatica: 117.7, ifix: 23.8, cdi: 11.95 },
  { date: "02-dez", tatica: 119.2, ifix: 24.1, cdi: 12.0 },
  { date: "03-dez", tatica: 118.8, ifix: 24.0, cdi: 12.05 },
  { date: "04-dez", tatica: 120.1, ifix: 24.3, cdi: 12.1 },
  { date: "05-dez", tatica: 119.7, ifix: 24.2, cdi: 12.15 },
  { date: "06-dez", tatica: 121.2, ifix: 24.5, cdi: 12.2 },
  { date: "09-dez", tatica: 120.8, ifix: 24.4, cdi: 12.25 },
  { date: "10-dez", tatica: 122.1, ifix: 24.7, cdi: 12.3 },
  { date: "11-dez", tatica: 121.7, ifix: 24.6, cdi: 12.35 },
  { date: "12-dez", tatica: 123.2, ifix: 24.9, cdi: 12.4 },
  { date: "13-dez", tatica: 122.8, ifix: 24.8, cdi: 12.45 },
  { date: "16-dez", tatica: 124.1, ifix: 25.1, cdi: 12.5 },
  { date: "17-dez", tatica: 123.7, ifix: 25.0, cdi: 12.55 },
  { date: "18-dez", tatica: 125.2, ifix: 25.3, cdi: 12.6 },
  { date: "19-dez", tatica: 124.8, ifix: 25.2, cdi: 12.65 },
  { date: "20-dez", tatica: 126.1, ifix: 25.5, cdi: 12.7 },
  { date: "23-dez", tatica: 125.7, ifix: 25.4, cdi: 12.75 },
  { date: "24-dez", tatica: 127.2, ifix: 25.7, cdi: 12.8 },
  { date: "27-dez", tatica: 126.8, ifix: 25.6, cdi: 12.85 },
  { date: "30-dez", tatica: 128.1, ifix: 25.9, cdi: 12.9 },
  { date: "31-dez", tatica: 127.7, ifix: 25.8, cdi: 12.95 },
  { date: "02-jan-25", tatica: 129.2, ifix: 26.1, cdi: 13.0 },
  { date: "03-jan-25", tatica: 128.8, ifix: 26.0, cdi: 13.05 },
  { date: "06-jan-25", tatica: 130.1, ifix: 26.3, cdi: 13.1 },
  { date: "07-jan-25", tatica: 129.7, ifix: 26.2, cdi: 13.15 },
  { date: "08-jan-25", tatica: 131.2, ifix: 26.5, cdi: 13.2 },
  { date: "09-jan-25", tatica: 130.8, ifix: 26.4, cdi: 13.25 },
  { date: "10-jan-25", tatica: 132.1, ifix: 26.7, cdi: 13.3 },
  { date: "13-jan-25", tatica: 131.7, ifix: 26.6, cdi: 13.35 },
  { date: "14-jan-25", tatica: 133.2, ifix: 26.9, cdi: 13.4 },
  { date: "15-jan-25", tatica: 132.8, ifix: 26.8, cdi: 13.45 },
  { date: "16-jan-25", tatica: 134.1, ifix: 27.1, cdi: 13.5 },
  { date: "17-jan-25", tatica: 133.7, ifix: 27.0, cdi: 13.55 },
  { date: "20-jan-25", tatica: 135.2, ifix: 27.3, cdi: 13.6 },
  { date: "21-jan-25", tatica: 134.8, ifix: 27.2, cdi: 13.65 },
  { date: "22-jan-25", tatica: 136.1, ifix: 27.5, cdi: 13.7 },
  { date: "23-jan-25", tatica: 135.7, ifix: 27.4, cdi: 13.75 },
  { date: "24-jan-25", tatica: 137.2, ifix: 27.7, cdi: 13.8 },
  { date: "27-jan-25", tatica: 136.8, ifix: 27.6, cdi: 13.85 },
  { date: "28-jan-25", tatica: 138.1, ifix: 27.9, cdi: 13.9 },
  { date: "29-jan-25", tatica: 137.7, ifix: 27.8, cdi: 13.95 },
  { date: "30-jan-25", tatica: 139.2, ifix: 28.1, cdi: 14.0 },
  { date: "31-jan-25", tatica: 138.8, ifix: 28.0, cdi: 14.05 },
  { date: "03-fev-25", tatica: 140.1, ifix: 28.3, cdi: 14.1 },
  { date: "04-fev-25", tatica: 139.7, ifix: 28.2, cdi: 14.15 },
  { date: "05-fev-25", tatica: 141.2, ifix: 28.5, cdi: 14.2 },
  { date: "06-fev-25", tatica: 140.8, ifix: 28.4, cdi: 14.25 },
  { date: "07-fev-25", tatica: 142.1, ifix: 28.7, cdi: 14.3 },
  { date: "10-fev-25", tatica: 141.7, ifix: 28.6, cdi: 14.35 },
  { date: "11-fev-25", tatica: 143.2, ifix: 28.9, cdi: 14.4 },
  { date: "12-fev-25", tatica: 142.8, ifix: 28.8, cdi: 14.45 },
  { date: "13-fev-25", tatica: 144.1, ifix: 29.1, cdi: 14.5 },
  { date: "14-fev-25", tatica: 143.7, ifix: 29.0, cdi: 14.55 },
  { date: "17-fev-25", tatica: 145.2, ifix: 29.3, cdi: 14.6 },
  { date: "18-fev-25", tatica: 144.8, ifix: 29.2, cdi: 14.65 },
  { date: "19-fev-25", tatica: 146.1, ifix: 29.5, cdi: 14.7 },
  { date: "20-fev-25", tatica: 145.7, ifix: 29.4, cdi: 14.75 },
  { date: "21-fev-25", tatica: 147.2, ifix: 29.7, cdi: 14.8 },
  { date: "24-fev-25", tatica: 146.8, ifix: 29.6, cdi: 14.85 },
  { date: "25-fev-25", tatica: 148.1, ifix: 29.9, cdi: 14.9 },
  { date: "26-fev-25", tatica: 147.7, ifix: 29.8, cdi: 14.95 },
  { date: "27-fev-25", tatica: 149.2, ifix: 30.1, cdi: 15.0 },
  { date: "28-fev-25", tatica: 148.8, ifix: 30.0, cdi: 15.05 },
  { date: "03-mar-25", tatica: 150.1, ifix: 30.3, cdi: 15.1 },
  { date: "04-mar-25", tatica: 149.7, ifix: 30.2, cdi: 15.15 },
  { date: "05-mar-25", tatica: 151.2, ifix: 30.5, cdi: 15.2 },
  { date: "06-mar-25", tatica: 150.8, ifix: 30.4, cdi: 15.25 },
  { date: "07-mar-25", tatica: 152.1, ifix: 30.7, cdi: 15.3 },
  { date: "10-mar-25", tatica: 151.7, ifix: 30.6, cdi: 15.35 },
  { date: "11-mar-25", tatica: 153.2, ifix: 30.9, cdi: 15.4 },
  { date: "12-mar-25", tatica: 152.8, ifix: 30.8, cdi: 15.45 },
  { date: "13-mar-25", tatica: 154.1, ifix: 31.1, cdi: 15.5 },
  { date: "14-mar-25", tatica: 153.7, ifix: 31.0, cdi: 15.55 },
  { date: "17-mar-25", tatica: 155.2, ifix: 31.3, cdi: 15.6 },
  { date: "18-mar-25", tatica: 154.8, ifix: 31.2, cdi: 15.65 },
  { date: "19-mar-25", tatica: 156.1, ifix: 31.5, cdi: 15.7 },
  { date: "20-mar-25", tatica: 155.7, ifix: 31.4, cdi: 15.75 },
  { date: "21-mar-25", tatica: 157.2, ifix: 31.7, cdi: 15.8 },
  { date: "24-mar-25", tatica: 156.8, ifix: 31.6, cdi: 15.85 },
  { date: "25-mar-25", tatica: 158.1, ifix: 31.9, cdi: 15.9 },
  { date: "26-mar-25", tatica: 157.7, ifix: 31.8, cdi: 15.95 },
  { date: "27-mar-25", tatica: 159.2, ifix: 32.1, cdi: 16.0 },
  { date: "28-mar-25", tatica: 158.8, ifix: 32.0, cdi: 16.05 },
  { date: "31-mar-25", tatica: 160.1, ifix: 32.3, cdi: 16.1 },
  { date: "01-abr-25", tatica: 159.7, ifix: 32.2, cdi: 16.15 },
  { date: "02-abr-25", tatica: 161.2, ifix: 32.5, cdi: 16.2 },
  { date: "03-abr-25", tatica: 160.8, ifix: 32.4, cdi: 16.25 },
  { date: "04-abr-25", tatica: 162.1, ifix: 32.7, cdi: 16.3 },
  { date: "07-abr-25", tatica: 161.7, ifix: 32.6, cdi: 16.35 },
  { date: "08-abr-25", tatica: 163.2, ifix: 32.9, cdi: 16.4 },
  { date: "09-abr-25", tatica: 162.8, ifix: 32.8, cdi: 16.45 },
  { date: "10-abr-25", tatica: 164.1, ifix: 33.1, cdi: 16.5 },
  { date: "11-abr-25", tatica: 163.7, ifix: 33.0, cdi: 16.55 },
  { date: "14-abr-25", tatica: 165.2, ifix: 33.3, cdi: 16.6 },
  { date: "15-abr-25", tatica: 164.8, ifix: 33.2, cdi: 16.65 },
  { date: "16-abr-25", tatica: 166.1, ifix: 33.5, cdi: 16.7 },
  { date: "17-abr-25", tatica: 165.7, ifix: 33.4, cdi: 16.75 },
  { date: "18-abr-25", tatica: 167.2, ifix: 33.7, cdi: 16.8 },
  { date: "21-abr-25", tatica: 166.8, ifix: 33.6, cdi: 16.85 },
  { date: "22-abr-25", tatica: 168.1, ifix: 33.9, cdi: 16.9 },
  { date: "23-abr-25", tatica: 167.7, ifix: 33.8, cdi: 16.95 },
  { date: "24-abr-25", tatica: 169.2, ifix: 34.1, cdi: 17.0 },
  { date: "25-abr-25", tatica: 168.8, ifix: 34.0, cdi: 17.05 },
  { date: "28-abr-25", tatica: 170.1, ifix: 34.3, cdi: 17.1 },
  { date: "29-abr-25", tatica: 169.7, ifix: 34.2, cdi: 17.15 },
  { date: "30-abr-25", tatica: 171.2, ifix: 34.5, cdi: 17.2 },
  { date: "01-mai-25", tatica: 170.8, ifix: 34.4, cdi: 17.25 },
  { date: "02-mai-25", tatica: 172.1, ifix: 34.7, cdi: 17.3 },
  { date: "05-mai-25", tatica: 171.7, ifix: 34.6, cdi: 17.35 },
  { date: "06-mai-25", tatica: 173.2, ifix: 34.9, cdi: 17.4 },
  { date: "07-mai-25", tatica: 172.8, ifix: 34.8, cdi: 17.45 },
  { date: "08-mai-25", tatica: 174.1, ifix: 35.1, cdi: 17.5 },
  { date: "09-mai-25", tatica: 173.7, ifix: 35.0, cdi: 17.55 },
  { date: "12-mai-25", tatica: 175.2, ifix: 35.3, cdi: 17.6 },
  { date: "13-mai-25", tatica: 174.8, ifix: 35.2, cdi: 17.65 },
  { date: "14-mai-25", tatica: 176.1, ifix: 35.5, cdi: 17.7 },
  { date: "15-mai-25", tatica: 175.7, ifix: 35.4, cdi: 17.75 },
  { date: "16-mai-25", tatica: 177.2, ifix: 35.7, cdi: 17.8 },
  { date: "19-mai-25", tatica: 176.8, ifix: 35.6, cdi: 17.85 },
  { date: "20-mai-25", tatica: 178.1, ifix: 35.9, cdi: 17.9 },
  { date: "21-mai-25", tatica: 177.7, ifix: 35.8, cdi: 17.95 },
  { date: "22-mai-25", tatica: 179.2, ifix: 36.1, cdi: 18.0 },
  { date: "23-mai-25", tatica: 178.8, ifix: 36.0, cdi: 18.05 },
  { date: "26-mai-25", tatica: 180.1, ifix: 36.3, cdi: 18.1 },
  { date: "27-mai-25", tatica: 179.7, ifix: 36.2, cdi: 18.15 },
  { date: "28-mai-25", tatica: 181.2, ifix: 36.5, cdi: 18.2 },
  { date: "29-mai-25", tatica: 180.8, ifix: 36.4, cdi: 18.25 },
  { date: "30-mai-25", tatica: 182.1, ifix: 36.7, cdi: 18.3 },
  { date: "02-jun-25", tatica: 181.7, ifix: 36.6, cdi: 18.35 },
  { date: "03-jun-25", tatica: 183.2, ifix: 36.9, cdi: 18.4 },
  { date: "04-jun-25", tatica: 182.8, ifix: 36.8, cdi: 18.45 },
  { date: "05-jun-25", tatica: 184.1, ifix: 37.1, cdi: 18.5 },
  { date: "06-jun-25", tatica: 183.7, ifix: 37.0, cdi: 18.55 },
  { date: "09-jun-25", tatica: 185.2, ifix: 37.3, cdi: 18.6 },
  { date: "10-jun-25", tatica: 184.8, ifix: 37.2, cdi: 18.65 },
  { date: "11-jun-25", tatica: 186.1, ifix: 37.5, cdi: 18.7 },
  { date: "12-jun-25", tatica: 185.7, ifix: 37.4, cdi: 18.75 },
  { date: "13-jun-25", tatica: 187.2, ifix: 37.7, cdi: 18.8 },
  { date: "16-jun-25", tatica: 186.8, ifix: 37.6, cdi: 18.85 },
  { date: "17-jun-25", tatica: 188.1, ifix: 37.9, cdi: 18.9 },
  { date: "18-jun-25", tatica: 187.7, ifix: 37.8, cdi: 18.95 },
  { date: "19-jun-25", tatica: 189.2, ifix: 38.1, cdi: 19.0 },
  { date: "20-jun-25", tatica: 188.8, ifix: 38.0, cdi: 19.05 },
  { date: "23-jun-25", tatica: 190.1, ifix: 38.3, cdi: 19.1 },
  { date: "24-jun-25", tatica: 189.7, ifix: 38.2, cdi: 19.15 },
  { date: "25-jun-25", tatica: 191.2, ifix: 38.5, cdi: 19.2 },
  { date: "26-jun-25", tatica: 190.8, ifix: 38.4, cdi: 19.25 },
  { date: "27-jun-25", tatica: 192.1, ifix: 38.7, cdi: 19.3 },
  { date: "30-jun-25", tatica: 191.7, ifix: 38.6, cdi: 19.35 },
  { date: "01-jul-25", tatica: 193.2, ifix: 38.9, cdi: 19.4 },
  { date: "02-jul-25", tatica: 192.8, ifix: 38.8, cdi: 19.45 },
  { date: "03-jul-25", tatica: 194.1, ifix: 39.1, cdi: 19.5 },
  { date: "04-jul-25", tatica: 193.7, ifix: 39.0, cdi: 19.55 },
  { date: "07-jul-25", tatica: 195.2, ifix: 39.3, cdi: 19.6 },
  { date: "08-jul-25", tatica: 194.8, ifix: 39.2, cdi: 19.65 },
  { date: "09-jul-25", tatica: 196.1, ifix: 39.5, cdi: 19.7 },
  { date: "10-jul-25", tatica: 195.7, ifix: 39.4, cdi: 19.75 },
  { date: "11-jul-25", tatica: 197.2, ifix: 39.7, cdi: 19.8 },
  { date: "14-jul-25", tatica: 196.8, ifix: 39.6, cdi: 19.85 },
  { date: "15-jul-25", tatica: 198.1, ifix: 39.9, cdi: 19.9 },
  { date: "16-jul-25", tatica: 197.7, ifix: 39.8, cdi: 19.95 },
  { date: "17-jul-25", tatica: 199.2, ifix: 40.1, cdi: 20.0 },
  { date: "18-jul-25", tatica: 198.8, ifix: 40.0, cdi: 20.05 },
  { date: "21-jul-25", tatica: 200.1, ifix: 40.3, cdi: 20.1 },
  { date: "22-jul-25", tatica: 199.7, ifix: 40.2, cdi: 20.15 },
  { date: "23-jul-25", tatica: 201.2, ifix: 40.5, cdi: 20.2 },
  { date: "24-jul-25", tatica: 200.8, ifix: 40.4, cdi: 20.25 },
  { date: "25-jul-25", tatica: 202.1, ifix: 40.7, cdi: 20.3 },
  { date: "28-jul-25", tatica: 201.7, ifix: 40.6, cdi: 20.35 },
  { date: "29-jul-25", tatica: 203.2, ifix: 40.9, cdi: 20.4 },
  { date: "30-jul-25", tatica: 202.8, ifix: 40.8, cdi: 20.45 },
  { date: "31-jul-25", tatica: 204.1, ifix: 41.1, cdi: 20.5 },
  { date: "01-ago-25", tatica: 203.7, ifix: 41.0, cdi: 20.55 },
  { date: "04-ago-25", tatica: 205.2, ifix: 41.3, cdi: 20.6 },
  { date: "05-ago-25", tatica: 204.8, ifix: 41.2, cdi: 20.65 },
  { date: "06-ago-25", tatica: 206.1, ifix: 41.5, cdi: 20.7 },
  { date: "07-ago-25", tatica: 205.7, ifix: 41.4, cdi: 20.75 },
  { date: "08-ago-25", tatica: 207.2, ifix: 41.7, cdi: 20.8 },
  { date: "11-ago-25", tatica: 206.8, ifix: 41.6, cdi: 20.85 },
  { date: "12-ago-25", tatica: 208.1, ifix: 41.9, cdi: 20.9 },
  { date: "13-ago-25", tatica: 207.7, ifix: 41.8, cdi: 20.95 },
  { date: "14-ago-25", tatica: 209.2, ifix: 42.1, cdi: 21.0 },
  { date: "15-ago-25", tatica: 208.8, ifix: 42.0, cdi: 21.05 },
  { date: "18-ago-25", tatica: 210.1, ifix: 42.3, cdi: 21.1 },
  { date: "19-ago-25", tatica: 209.7, ifix: 42.2, cdi: 21.15 },
  { date: "20-ago-25", tatica: 211.2, ifix: 42.5, cdi: 21.2 },
  { date: "21-ago-25", tatica: 210.8, ifix: 42.4, cdi: 21.25 },
  { date: "22-ago-25", tatica: 212.1, ifix: 42.7, cdi: 21.3 },
  { date: "25-ago-25", tatica: 211.7, ifix: 42.6, cdi: 21.35 },
  { date: "26-ago-25", tatica: 213.2, ifix: 42.9, cdi: 21.4 },
  { date: "27-ago-25", tatica: 212.8, ifix: 42.8, cdi: 21.45 },
  { date: "28-ago-25", tatica: 214.1, ifix: 43.1, cdi: 21.5 },
  { date: "29-ago-25", tatica: 213.7, ifix: 43.0, cdi: 21.55 },
  { date: "01-set-25", tatica: 215.2, ifix: 43.3, cdi: 21.6 },
  { date: "02-set-25", tatica: 214.8, ifix: 43.2, cdi: 21.65 },
  { date: "03-set-25", tatica: 216.1, ifix: 43.5, cdi: 21.7 },
  { date: "04-set-25", tatica: 215.7, ifix: 43.4, cdi: 21.75 },
  { date: "05-set-25", tatica: 217.2, ifix: 43.7, cdi: 21.8 },
  { date: "08-set-25", tatica: 216.8, ifix: 43.6, cdi: 21.85 },
  { date: "09-set-25", tatica: 218.1, ifix: 43.9, cdi: 21.9 },
  { date: "10-set-25", tatica: 217.7, ifix: 43.8, cdi: 21.95 },
  { date: "11-set-25", tatica: 219.2, ifix: 44.1, cdi: 22.0 },
  { date: "12-set-25", tatica: 218.8, ifix: 44.0, cdi: 22.05 },
  { date: "15-set-25", tatica: 220.1, ifix: 44.3, cdi: 22.1 },
  { date: "16-set-25", tatica: 219.7, ifix: 44.2, cdi: 22.15 },
  { date: "17-set-25", tatica: 221.2, ifix: 44.5, cdi: 22.2 },
  { date: "18-set-25", tatica: 220.8, ifix: 44.4, cdi: 22.25 },
  { date: "19-set-25", tatica: 222.1, ifix: 44.7, cdi: 22.3 },
  { date: "22-set-25", tatica: 221.7, ifix: 44.6, cdi: 22.35 },
  { date: "23-set-25", tatica: 223.2, ifix: 44.9, cdi: 22.4 },
  { date: "24-set-25", tatica: 222.8, ifix: 44.8, cdi: 22.45 },
  { date: "25-set-25", tatica: 224.1, ifix: 45.1, cdi: 22.5 },
  { date: "26-set-25", tatica: 223.7, ifix: 45.0, cdi: 22.55 },
  { date: "29-set-25", tatica: 225.2, ifix: 45.3, cdi: 22.6 },
  { date: "30-set-25", tatica: 224.8, ifix: 45.2, cdi: 22.65 }
];

// Componente para o preview da arte
function StoriesPreview({ 
  carteira, 
  periodo, 
  dados, 
  retornoTotal, 
  vsIfix, 
  vsCdi 
}: {
  carteira: string;
  periodo: string;
  dados: any[];
  retornoTotal: number;
  vsIfix: number;
  vsCdi: number;
}) {
  return (
    <div 
      id="stories-preview"
      className="w-[270px] h-[480px] bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 relative overflow-hidden"
      style={{ aspectRatio: '9/16' }}
    >
      {/* Logo no topo */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="w-24 h-8 bg-white rounded px-2 flex items-center justify-center">
          <span className="text-gray-900 font-bold text-sm">UP</span>
        </div>
      </div>

      {/* Título */}
      <div className="absolute top-16 left-4 right-4 z-10">
        <h1 className="text-white text-xl font-bold mb-1">{carteira}</h1>
        <p className="text-cyan-200 text-sm">Retorno Histórico</p>
      </div>

      {/* Gráfico */}
      <div className="absolute top-32 left-4 right-4 bottom-32 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados}>
            <defs>
              <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="tatica"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#colorRet)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Métricas no rodapé */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-gray-800/80 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-cyan-400 text-lg font-bold">+{retornoTotal.toFixed(1)}%</div>
            <div className="text-gray-300 text-xs">vs IFIX: +{vsIfix.toFixed(1)}%</div>
            <div className="text-gray-300 text-xs">vs CDI: +{vsCdi.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Invista com UP
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const [carteira, setCarteira] = useState('BlackBox FIIs');
  const [periodo, setPeriodo] = useState('2020-2025');
  const [dadosFiltrados, setDadosFiltrados] = useState(retornoData);
  const [retornoTotal, setRetornoTotal] = useState(32.59);
  const [vsIfix, setVsIfix] = useState(9.34);
  const [vsCdi, setVsCdi] = useState(12.98);

  // Filtrar dados baseado no período selecionado
  useEffect(() => {
    if (periodo === '2020-2025') {
      setDadosFiltrados(retornoData);
      setRetornoTotal(32.59);
      setVsIfix(9.34);
      setVsCdi(12.98);
    } else if (periodo === '2023-2025') {
      const filtrados = retornoData.filter(d => d.date.includes('23') || d.date.includes('24') || d.date.includes('25'));
      setDadosFiltrados(filtrados);
      setRetornoTotal(28.45);
      setVsIfix(7.23);
      setVsCdi(9.87);
    } else if (periodo === '2024-2025') {
      const filtrados = retornoData.filter(d => d.date.includes('24') || d.date.includes('25'));
      setDadosFiltrados(filtrados);
      setRetornoTotal(18.32);
      setVsIfix(4.56);
      setVsCdi(6.78);
    }
  }, [periodo]);

  const handleExport = async () => {
    const element = document.getElementById('stories-preview');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        width: 1080,
        height: 1920,
        scale: 4, // Alta resolução
        useCORS: true,
        backgroundColor: null
      });

      const link = document.createElement('a');
      link.download = `up-${carteira.toLowerCase().replace(/\s+/g, '-')}-${periodo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Marketing - Gerador de Artes</h1>
        <div className="text-sm text-gray-400">
          Crie artes profissionais para stories e campanhas
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel de Configuração */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Configurações</h2>
          
          <div className="space-y-4">
            {/* Seleção de Carteira */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Carteira
              </label>
              <select
                value={carteira}
                onChange={(e) => setCarteira(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="BlackBox FIIs">BlackBox FIIs</option>
                <option value="BlackBox Multi">BlackBox Multi</option>
                <option value="BlackBox Ações">BlackBox Ações</option>
              </select>
            </div>

            {/* Seleção de Período */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Período
              </label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="2020-2025">2020-2025 (5 anos)</option>
                <option value="2023-2025">2023-2025 (3 anos)</option>
                <option value="2024-2025">2024-2025 (2 anos)</option>
              </select>
            </div>

            {/* Botão de Exportação */}
            <button
              onClick={handleExport}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PNG (1080x1920)
            </button>
          </div>
        </div>

        {/* Preview da Arte */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Preview da Arte</h2>
          
          <div className="flex justify-center">
            <StoriesPreview
              carteira={carteira}
              periodo={periodo}
              dados={dadosFiltrados}
              retornoTotal={retornoTotal}
              vsIfix={vsIfix}
              vsCdi={vsCdi}
            />
          </div>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Informações da Arte</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-cyan-400 font-semibold">Dimensões</div>
            <div className="text-gray-300">1080x1920px (9:16)</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-cyan-400 font-semibold">Formato</div>
            <div className="text-gray-300">PNG (Alta Resolução)</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-cyan-400 font-semibold">Uso</div>
            <div className="text-gray-300">Stories Instagram/Facebook</div>
          </div>
        </div>
      </div>
    </div>
  );
}
