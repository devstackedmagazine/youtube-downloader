import Link from "next/link";
import { Metadata } from "next";
import AdPlaceholder from "@/components/AdPlaceholder";

export const metadata: Metadata = {
  title: "Free YouTube Video Downloader - Download Videos as MP4 or MP3",
  description: "Download YouTube videos instantly as MP4 or MP3. No watermarks, no limits, 100% free.",
};

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-b from-indigo-50 to-white py-20 lg:py-32">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6">
            Download YouTube Videos <br className="hidden md:block"/>
            <span className="text-indigo-600">Fast & Free</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Convert and download your favorite YouTube videos as high-quality MP4 or MP3.
            No software installation required, no limits, and absolutely free.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
            <Link 
              href="/download" 
              className="inline-flex h-12 items-center justify-center rounded-md bg-indigo-600 px-8 text-base font-medium text-white shadow transition-colors hover:bg-indigo-700"
            >
              Start Downloading Now
            </Link>
            <Link 
              href="#features" 
              className="inline-flex h-12 items-center justify-center rounded-md border border-gray-300 bg-white px-8 text-base font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Learn More
            </Link>
          </div>
          
          <div className="max-w-3xl mx-auto mt-12">
            <AdPlaceholder className="h-32" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose DLTube?</h2>
            <p className="text-lg text-gray-600">Built for speed, convenience, and quality.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              title="High Quality MP4"
              description="Download videos in up to 4K resolution with clear audio and crisp visuals."
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>}
            />
            <FeatureCard 
              title="Crystal Clear MP3"
              description="Extract audio in 320kbps MP3 format for the ultimate listening experience."
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>}
            />
            <FeatureCard 
              title="Lightning Fast"
              description="Our optimized servers ensure your conversions finish in seconds, not minutes."
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
            />
            <FeatureCard 
              title="100% Free & Safe"
              description="No sketchy software, no hidden fees, and entirely free of malicious ads."
              icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>}
            />
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="w-full py-20 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600">3 simple steps to download any video.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-0.5 bg-gray-200 z-0"></div>
            
            <StepCard 
              number="1"
              title="Copy the URL"
              description="Find the video you want on YouTube and copy its URL from your browser's address bar."
            />
            <StepCard 
              number="2"
              title="Paste & Select Format"
              description="Paste the link on our download page and choose whether you want MP4 video or MP3 audio."
            />
            <StepCard 
              number="3"
              title="Download & Enjoy"
              description="Click convert, wait a few seconds, and download your file directly to your device."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-24 bg-indigo-600 text-white text-center">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to start downloading?</h2>
          <p className="text-xl text-indigo-100 max-w-2xl mx-auto mb-10">
            Join thousands of users who trust DLTube for their daily video needs.
          </p>
          <Link 
            href="/download" 
            className="inline-flex h-14 items-center justify-center rounded-md bg-white px-8 text-lg font-bold text-indigo-600 shadow-md transition-transform hover:scale-105"
          >
            Go to Download Page
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
      <div className="p-3 bg-white rounded-full shadow-sm mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center relative z-10">
      <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg">
        {number}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
