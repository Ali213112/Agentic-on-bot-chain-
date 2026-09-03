import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { LiveTicker } from "@/components/LiveTicker";
import { HowItWorks } from "@/components/HowItWorks";
import { AgentsSection } from "@/components/AgentsSection";
import { MarketsSection } from "@/components/MarketsSection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <LiveTicker />
        <HowItWorks />
        <AgentsSection />
        <MarketsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
