"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

const formats = [
  { name: "MP4", note: "The visual cut", image: "https://picsum.photos/seed/film-projector/1000/1200", tint: "#d9e7df" },
  { name: "MP3", note: "The listening cut", image: "https://picsum.photos/seed/cassette-tape/1000/1200", tint: "#f2d2c2" },
  { name: "4K", note: "The full-resolution cut", image: "https://picsum.photos/seed/landscape-scan/1000/1200", tint: "#ded8ed" },
];

export default function MotionShowcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const cards = gsap.utils.toArray<HTMLElement>("[data-format-card]");
    cards.forEach((card) => {
      gsap.fromTo(card, { scale: 0.8, opacity: 0.2 }, { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: card, start: "top 88%", end: "bottom 18%", scrub: true } });
    });
    gsap.to("[data-reveal-word]", { opacity: 1, stagger: 0.08, ease: "none", scrollTrigger: { trigger: sectionRef.current, start: "top 68%", end: "center 35%", scrub: true } });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="bg-[#11110f] px-6 py-32 text-[#f6f2e9] sm:px-10 md:py-48 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-20 lg:grid-cols-[.7fr_1.3fr]">
        <div className="lg:sticky lg:top-32 lg:h-fit">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#ff6b35]">Made to move</p>
          <h2 className="font-display text-6xl leading-[.9] tracking-[-.08em] sm:text-8xl">One source.<br /><span className="text-[#77736a]">Many ways</span><br />to keep it.</h2>
          <p className="mt-10 max-w-sm text-lg leading-relaxed text-[#bdb9af]">{["The", "right", "format", "is", "the", "one", "that", "fits", "your", "next", "move."].map((word) => <span key={word} data-reveal-word className="mr-[.3em] inline-block opacity-10">{word}</span>)}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {formats.map((format, index) => <article key={format.name} data-format-card className={`surface-hover surface-hover--dark group relative min-h-[540px] overflow-hidden rounded-[2rem] p-7 ${index === 2 ? "sm:col-span-2 sm:min-h-[360px]" : ""}`} style={{ backgroundColor: format.tint }}><div className="absolute inset-0 overflow-hidden"><img src={format.image} alt="" className="h-full w-full object-cover opacity-80 mix-blend-multiply grayscale transition duration-700 group-hover:scale-105 group-hover:grayscale-0" /></div><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" /><div className="relative flex h-full flex-col justify-between"><div className="flex justify-between text-sm font-semibold text-white"><span>{format.note}</span><span>0{index + 1}</span></div><div><h3 className="font-display text-8xl leading-none tracking-[-.09em] text-white">{format.name}</h3><p className="mt-3 text-sm text-white/75">Select the quality that feels right, then let it run.</p></div></div></article>)}
        </div>
      </div>
    </section>
  );
}
