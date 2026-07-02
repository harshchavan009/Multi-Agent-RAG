import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  collapsed?: boolean;
  lightText?: boolean;
}

export default function BrandLogo({ className = "", size = "md", collapsed = false, lightText = false }: BrandLogoProps) {
  const getLogoSize = () => {
    switch (size) {
      case "sm": return { box: "h-6 w-6", text: "text-xs", iconSize: "14" };
      case "lg": return { box: "h-10 w-10", text: "text-lg", iconSize: "22" };
      case "xl": return { box: "h-16 w-16", text: "text-3xl", iconSize: "36" };
      default: return { box: "h-8 w-8", text: "text-sm", iconSize: "18" };
    }
  };

  const dims = getLogoSize();

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Icon Mark */}
      <div 
        className={`${dims.box} rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 shrink-0 select-none`}
      >
        <svg viewBox="0 0 24 24" width={dims.iconSize} height={dims.iconSize} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6" cy="6" r="2.5" fill="currentColor" />
          <circle cx="18" cy="18" r="2.5" fill="currentColor" />
          <path d="M 6 6 L 18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 9 6 C 14 6, 10 18, 15 18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" opacity="0.75" />
        </svg>
      </div>

      {/* Styled Brand Name Text */}
      {!collapsed && (
        <div className="flex flex-col min-w-0 transition-all duration-300">
          <span className={`font-extrabold tracking-tight leading-none ${lightText ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>
            Intel<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Flow</span>
          </span>
          <span className={`text-[9px] uppercase tracking-widest font-black mt-1 ${lightText ? "text-slate-400" : "text-slate-450 dark:text-slate-500"}`}>
            Agentic OS
          </span>
        </div>
      )}
    </div>
  );
}
