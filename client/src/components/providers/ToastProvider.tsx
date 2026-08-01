"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4200,
        style: {
          border: "1px solid #d8e2ea",
          borderRadius: "8px",
          boxShadow: "0 18px 45px rgba(21, 34, 47, 0.16)",
          color: "#15222f",
          fontSize: "14px",
          maxWidth: "420px",
          padding: "14px 16px",
        },
        success: {
          iconTheme: {
            primary: "#0f766e",
            secondary: "#ffffff",
          },
        },
        error: {
          iconTheme: {
            primary: "#c2410c",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}
