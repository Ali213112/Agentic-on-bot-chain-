import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "Agentic Trading | BOT Chain Testnet",
  description:
    "AI agents research, debate, and trade crypto on BOT Chain testnet. Pick your agents, set your amount, watch them work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
