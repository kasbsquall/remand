import { Bricolage_Grotesque, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import { Metadata } from "next";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import "~~/styles/remand.css";

// Bricolage Grotesque pone la voz de la marca en el logotipo y los titulares.
// Tiene eje de tamano optico, asi que ajusta su forma al cuerpo en el que se usa
// en vez de escalar el mismo dibujo.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  // Sin declarar el eje, next/font sirve solo el de peso y el tamano optico no
  // ocurre, que era justamente el argumento para elegir esta familia.
  axes: ["opsz"],
  display: "swap",
});

// Newsreader lleva la voz del acta: serif con eje de tamano optico, se
// comporta distinto en un titular que en un parrafo. Inter queda fuera a
// proposito, es la firma tipografica del output generado.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-text",
  axes: ["opsz"],
  display: "swap",
});

// Toda cifra que se compare en columna va en mono con figuras tabulares.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500", "600"],
  display: "swap",
});

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;
const imageUrl = `${baseUrl}/thumbnail.jpg`;

const title = "Remand";
const titleTemplate = "%s | Remand";
const description =
  "La segunda instancia del credito on-chain. Si te niegan un prestamo, tu caso se reabre con evidencia y el veredicto se recalcula en Arbitrum Stylus, verificable por cualquiera.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: titleTemplate,
  },
  description,
  openGraph: {
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
    images: [
      {
        url: imageUrl,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [imageUrl],
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
  },
  icons: {
    icon: [{ url: "/remand-mark.svg", type: "image/svg+xml" }],
  },
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning>
      <body
        className={`${bricolage.variable} ${newsreader.variable} ${plexMono.variable} font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
