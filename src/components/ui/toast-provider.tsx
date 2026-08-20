'use client';

import { ToastContainer } from 'react-toastify';

export default function ToastProvider() {
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      theme="dark"
      toastClassName={() =>
        'bg-surface-deeper border border-surface-liner text-surface-light rounded shadow-lg text-sm'
      }
      progressClassName="bg-accent"
    />
  );
}
