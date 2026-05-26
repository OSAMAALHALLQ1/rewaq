import React from "react";

export default function DepartmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col select-none antialiased font-sans">
      {/* Decorative top ambient bar */}
      <div className="h-1 bg-gradient-to-r from-teal-500 via-primary to-blue-600 w-full shrink-0" />
      
      {/* Immersive wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
