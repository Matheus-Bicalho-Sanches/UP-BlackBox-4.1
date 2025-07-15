import { redirect } from 'next/navigation';
 
export default function BacktestsRoot() {
  redirect('/dashboard/backtests/base-de-dados');
  return null;
} 