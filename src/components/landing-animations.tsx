"use client"

import { useEffect, useState } from "react"

export function LandingAnimations() {
  return (
    <>
      <RainingSymbols />
    </>
  )
}

function RainingSymbols() {
  const symbols = ['🧪', '🔬', '🧫', '⚛️', '🧬', '🔭']
  const [drops, setDrops] = useState<{ id: number; left: number; delay: number; symbol: string; duration: number }[]>([])

  useEffect(() => {
    const count = 30
    const newDrops = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      duration: 4 + Math.random() * 4
    }))
    setDrops(newDrops)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute top-[-50px] text-4xl opacity-10 animate-fall"
          style={{
            left: `${drop.left}%`,
            animation: `fall ${drop.duration}s linear infinite`,
            animationDelay: `${drop.delay}s`
          }}
        >
          {drop.symbol}
        </div>
      ))}
      <style jsx global>{`
        @keyframes fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.2; }
          90% { opacity: 0.2; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
