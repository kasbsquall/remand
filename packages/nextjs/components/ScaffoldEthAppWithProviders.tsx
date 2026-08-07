"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BackGround } from "./Background";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { Footer } from "~~/components/Footer";
import { Header } from "~~/components/Header";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { arbitrumNitro, initBurnerPK } from "~~/utils/scaffold-stylus";

/**
 * Rutas de herramienta que trae Scaffold-Stylus. Conservan su propio armazon,
 * que es util para depurar el contrato. Las rutas del producto no: Remand tiene
 * su propia cabecera y su propio pie, y montar los dos sistemas encima
 * rompe la direccion de diseno y duplica la navegacion.
 */
const RUTAS_DE_HERRAMIENTA = ["/debug", "/blockexplorer"];

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  const { targetNetwork } = useTargetNetwork();
  const pathname = usePathname();
  const esHerramienta = RUTAS_DE_HERRAMIENTA.some(ruta => pathname?.startsWith(ruta));

  useEffect(() => {
    if (targetNetwork.id === arbitrumNitro.id) {
      initBurnerPK();
    }
  }, [targetNetwork]);

  if (!esHerramienta) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="relative flex flex-col flex-1">
          <BackGround />
          {children}
        </main>
        <Footer />
      </div>
      <Toaster />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ProgressBar height="3px" color="#2299dd" />
        <RainbowKitProvider
          avatar={BlockieAvatar}
          theme={mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()}
        >
          <ScaffoldEthApp>{children}</ScaffoldEthApp>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
