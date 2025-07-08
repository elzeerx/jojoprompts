import React from 'react';

export function AnimatedBackground() {
  return (
    <>
      {/* Main background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/lovable-uploads/aa68f984-e890-4e40-938e-913cd0114679.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-warm-gold/20 via-transparent to-muted-teal/20 animate-gradient-shift"></div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-warm-gold/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-3/4 right-1/4 w-40 h-40 bg-muted-teal/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-3/4 w-24 h-24 bg-warm-gold/15 rounded-full blur-lg animate-float" style={{ animationDelay: '1s' }}></div>
        
        {/* Small floating particles */}
        <div className="absolute top-20 left-1/3 w-3 h-3 bg-warm-gold/40 rounded-full animate-pulse-gentle"></div>
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-muted-teal/40 rounded-full animate-pulse-gentle" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute bottom-1/3 left-1/5 w-4 h-4 bg-warm-gold/30 rounded-full animate-pulse-gentle" style={{ animationDelay: '0.8s' }}></div>
        <div className="absolute bottom-20 right-1/5 w-2 h-2 bg-muted-teal/50 rounded-full animate-pulse-gentle" style={{ animationDelay: '2.2s' }}></div>
      </div>
      
      {/* Subtle moving mesh gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-warm-gold/5 to-transparent animate-slide-x"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-muted-teal/5 to-transparent animate-slide-y"></div>
      </div>
    </>
  );
}