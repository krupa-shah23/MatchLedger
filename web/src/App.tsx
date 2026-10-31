import React from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthProvider.js";
import { AppRoutes } from "./router.js";
import { ToastProvider } from "./components/Toast.js";

const queryClient = new QueryClient();

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <AppRoutes />
          </QueryClientProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
