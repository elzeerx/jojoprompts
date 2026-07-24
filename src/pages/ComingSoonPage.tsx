import { useEffect } from "react";

/**
 * Coming Soon — Public Launch Lock page.
 * No CTAs, no navigation, no forms. Bilingual EN + AR editorial layout.
 * Rendered whenever PUBLIC_LAUNCH_LOCK is true, for every non-admin route.
 */
export default function ComingSoonPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "JojoPrompts — Coming soon";

    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    const robots = setMeta("robots", "noindex,nofollow");
    const desc = setMeta(
      "description",
      "JojoPrompts is being rebuilt for the next generation of AI — skills, automations, prompts, image styles, and more.",
    );
    const ogTitle = setMeta("og:title", "JojoPrompts — Coming soon", "property");
    const ogDesc = setMeta(
      "og:description",
      "Something new is taking shape.",
      "property",
    );

    return () => {
      document.title = prevTitle;
      // leave meta tags in place; harmless while locked
      void robots; void desc; void ogTitle; void ogDesc;
    };
  }, []);

  return (
    <main
      dir="ltr"
      className="relative flex h-[100dvh] w-full flex-col overflow-x-hidden overflow-y-auto bg-[#0B0B0C] text-[#F3EFE6] antialiased lg:overflow-hidden"
      style={{
        fontFamily:
          '"Playfair Display", "Cormorant Garamond", ui-serif, Georgia, "Times New Roman", serif',
      }}
    >
      {/* Subtle grain / vignette overlay — decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, transparent 40%, #000 100%), url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/></svg>\")",
        }}
      />

      {/* Wordmark */}
      <header
        dir="ltr"
        className="relative z-10 flex-none px-6 pt-5 sm:px-10 sm:pt-6 lg:px-16 lg:pt-6"
      >
        <p
          className="text-2xl tracking-tight text-[#C9A55C] sm:text-3xl lg:text-[26px]"
          style={{ letterSpacing: "0.005em" }}
        >
          JojoPrompts
        </p>
      </header>

      {/* Body */}
      <section className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center gap-10 px-6 py-8 sm:px-10 sm:py-10 lg:min-h-0 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-16 lg:py-4">
        {/* English editorial block */}
        <div dir="ltr" lang="en" className="max-w-md text-center lg:max-w-sm lg:text-left">
          <h1
            className="text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] tracking-tight text-[#F3EFE6]"
            style={{ fontWeight: 500 }}
          >
            Something new
            <br />
            is taking shape.
          </h1>
          <Divider />
          <p
            className="mt-5 text-[15px] leading-relaxed text-[#B8B2A6] sm:text-base"
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            JojoPrompts is being rebuilt for the next generation of AI — skills,
            automations, prompts, image styles, and more.
          </p>
        </div>

        {/* Central diagram */}
        <div className="flex flex-shrink-0 items-center justify-center">
          <NodeDiagram />
        </div>

        {/* Arabic RTL block */}
        <div dir="rtl" lang="ar" className="max-w-md text-center lg:max-w-sm lg:text-right">
          <h2
            className="text-[clamp(3rem,6vw,5rem)] leading-none text-[#F3EFE6]"
            style={{ fontFamily: '"Amiri", "Scheherazade New", serif', fontWeight: 500 }}
          >
            قريباً
          </h2>
          <Divider />
          <p
            className="mt-5 text-[15px] leading-loose text-[#B8B2A6] sm:text-base"
            style={{ fontFamily: '"Amiri", "Noto Naskh Arabic", serif' }}
          >
            نعيد بناء جوجو برومبتس لعصر جديد من مهارات وأتمتة وأدوات الذكاء
            الاصطناعي.
          </p>
        </div>
      </section>

      {/* Mobile-only "Coming soon" flourish (matches attached mobile concept) */}
      <div className="relative z-10 flex-none px-6 pb-2 text-center lg:hidden">
        <p
          className="text-[clamp(2rem,8vw,2.75rem)] leading-none text-[#C9A55C]"
          style={{ fontWeight: 500 }}
        >
          Coming soon
        </p>
      </div>

      {/* Footer */}
      <footer className="relative z-10 flex-none pb-5 pt-2 text-center sm:pb-6">
        <DiamondRule />
        <p
          className="mt-3 text-xs tracking-wide text-[#8A8578]"
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          }}
        >
          © 2026 JojoPrompts
        </p>
      </footer>
    </main>
  );
}

function Divider() {
  return (
    <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
      <span className="h-px w-16 bg-[#C9A55C]/50" />
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rotate-45 border border-[#C9A55C]/70"
      />
      <span className="h-px w-16 bg-[#C9A55C]/50" />
    </div>
  );
}

function DiamondRule() {
  return (
    <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-3">
      <span className="h-px flex-1 bg-[#C9A55C]/30" />
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rotate-45 border border-[#C9A55C]/60"
      />
      <span className="h-px flex-1 bg-[#C9A55C]/30" />
    </div>
  );
}

/**
 * Editorial, code-native SVG diagram — modular skills / workflow nodes.
 * Purely decorative; hidden from AT.
 */
function NodeDiagram() {
  const stroke = "#C9A55C";
  const soft = "#C9A55C";
  const reduce = "motion-reduce:animate-none";
  return (
    <svg
      role="img"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 360 360"
      className="h-[280px] w-[280px] sm:h-[340px] sm:w-[340px] lg:h-[380px] lg:w-[380px]"
    >
      {/* Outer hex guides (dashed, low-opacity) */}
      <g stroke={soft} strokeOpacity="0.22" fill="none" strokeDasharray="2 4">
        <polygon points="180,30 310,105 310,255 180,330 50,255 50,105" />
      </g>

      {/* Connecting links */}
      <g stroke={stroke} strokeOpacity="0.55" fill="none" strokeWidth="1">
        <path d="M180 70 L180 140" />
        <path d="M110 105 L155 150" />
        <path d="M250 105 L205 150" />
        <path d="M110 255 L155 210" />
        <path d="M250 255 L205 210" />
        <path d="M180 220 L180 290" />
        {/* small dots along edges */}
        {[100, 140, 220, 260].map((y) => (
          <circle key={y} cx="180" cy={y} r="1.5" fill={stroke} />
        ))}
      </g>

      {/* Central stacked layers */}
      <g stroke={stroke} fill="none" strokeWidth="1.25">
        <rect x="140" y="150" width="80" height="72" rx="10" strokeOpacity="0.45" />
        <path d="M150 172 L180 158 L210 172 L180 186 Z" />
        <path d="M150 186 L180 172 L210 186 L180 200 Z" strokeOpacity="0.8" />
        <path d="M150 200 L180 186 L210 200 L180 214 Z" strokeOpacity="0.6" />
      </g>

      {/* Node badges */}
      <NodeBadge cx={180} cy={55} label="spark" />
      <NodeBadge cx={95} cy={105} label="puzzle" />
      <NodeBadge cx={265} cy={105} label="tree" />
      <NodeBadge cx={95} cy={255} label="text" />
      <NodeBadge cx={265} cy={255} label="image" />
      <NodeBadge cx={180} cy={305} label="grid" />

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .lb-pulse { animation: lb-pulse 6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
        }
        @keyframes lb-pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
      `}</style>
      {/* animated accent on center layer */}
      <circle cx="180" cy="186" r="2" fill={stroke} className={`lb-pulse ${reduce}`} />
    </svg>
  );
}

function NodeBadge({
  cx,
  cy,
  label,
}: {
  cx: number;
  cy: number;
  label: "spark" | "puzzle" | "tree" | "text" | "image" | "grid";
}) {
  const stroke = "#C9A55C";
  return (
    <g stroke={stroke} fill="none" strokeWidth="1.1">
      <circle cx={cx} cy={cy} r="22" strokeOpacity="0.75" />
      <circle cx={cx} cy={cy} r="26" strokeOpacity="0.15" />
      <g transform={`translate(${cx - 8} ${cy - 8})`}>
        {label === "spark" && (
          <path d="M8 0 L10 6 L16 8 L10 10 L8 16 L6 10 L0 8 L6 6 Z" strokeLinejoin="round" />
        )}
        {label === "puzzle" && (
          <path d="M2 4 h5 a2 2 0 1 1 2 0 h5 v5 a2 2 0 1 0 0 2 v5 h-5 a2 2 0 1 1 -2 0 h-5 v-5 a2 2 0 1 0 0 -2 z" />
        )}
        {label === "tree" && (
          <g>
            <rect x="6" y="0" width="4" height="4" />
            <rect x="0" y="12" width="4" height="4" />
            <rect x="12" y="12" width="4" height="4" />
            <path d="M8 4 v4 M2 12 V8 h12 v4" />
          </g>
        )}
        {label === "text" && (
          <g strokeDasharray="2 2">
            <rect x="0" y="0" width="16" height="16" rx="1" />
            <text x="8" y="12" fontSize="10" textAnchor="middle" fill={stroke} stroke="none" fontFamily="serif">T</text>
          </g>
        )}
        {label === "image" && (
          <g>
            <rect x="0" y="0" width="16" height="16" rx="2" />
            <circle cx="5" cy="6" r="1.5" />
            <path d="M1 14 L6 9 L10 12 L15 6 L15 15 L1 15 Z" />
          </g>
        )}
        {label === "grid" && (
          <g>
            <rect x="0" y="0" width="7" height="7" rx="1" />
            <rect x="9" y="0" width="7" height="7" rx="1" />
            <rect x="0" y="9" width="7" height="7" rx="1" />
            <rect x="9" y="9" width="7" height="7" rx="1" />
          </g>
        )}
      </g>
    </g>
  );
}
