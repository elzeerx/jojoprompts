
import React from 'react';
import { Check, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export function PricingComparison() {
  const isMobile = useIsMobile();
  
  const features = [
    { name: 'ChatGPT Prompts', basic: true, standard: true, premium: true, ultimate: true },
    { name: 'Midjourney Prompts', basic: false, standard: true, premium: true, ultimate: true },
    { name: 'n8n Workflows', basic: false, standard: false, premium: true, ultimate: true },
    { name: 'Future Categories', basic: false, standard: false, premium: true, ultimate: true },
    { name: 'Email Support', basic: 'Basic', standard: 'Standard', premium: 'Priority', ultimate: 'Priority' },
    { name: 'Lifetime Access', basic: false, standard: false, premium: true, ultimate: true },
    { name: 'Special Prompt Requests', basic: false, standard: false, premium: false, ultimate: '20 requests' },
  ];

  const renderCell = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-warm-gold mx-auto" />
      ) : (
        <X className="h-4 w-4 text-gray-300 mx-auto" />
      );
    }
    return <span className="text-center block text-xs sm:text-sm font-medium text-dark-base">{value}</span>;
  };

  if (isMobile) {
    // Mobile-first minimalist comparison
    return (
      <div className="space-y-4">
        {/* Mobile Plan Headers - gap-px grid */}
        <div className="grid grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="bg-white p-4 text-center group hover:bg-gray-50/50 transition-colors duration-300">
            <h3 className="font-medium text-sm text-dark-base">Basic</h3>
            <p className="text-xs text-muted-foreground font-light">$55</p>
          </div>
          <div className="bg-white p-4 text-center group hover:bg-gray-50/50 transition-colors duration-300">
            <h3 className="font-medium text-sm text-dark-base">Standard</h3>
            <p className="text-xs text-muted-foreground font-light">$65</p>
          </div>
          <div className="bg-warm-gold/5 p-4 text-center group hover:bg-warm-gold/10 transition-colors duration-300">
            <h3 className="font-medium text-sm text-warm-gold">Premium</h3>
            <p className="text-xs text-muted-foreground font-light">$80</p>
          </div>
          <div className="bg-white p-4 text-center group hover:bg-gray-50/50 transition-colors duration-300">
            <h3 className="font-medium text-sm text-dark-base">Ultimate</h3>
            <p className="text-xs text-muted-foreground font-light">$100</p>
          </div>
        </div>

        {/* Mobile Feature Comparison - gap-px pattern */}
        <div className="grid gap-px bg-gray-200 rounded-xl overflow-hidden">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white p-4 sm:p-5 group hover:bg-gray-50/50 transition-colors duration-300 relative">
              <h4 className="font-medium text-sm mb-3 text-dark-base">{feature.name}</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <span className="text-xs text-muted-foreground block mb-1 font-light">Basic</span>
                  {renderCell(feature.basic)}
                </div>
                <div className="text-center">
                  <span className="text-xs text-muted-foreground block mb-1 font-light">Std</span>
                  {renderCell(feature.standard)}
                </div>
                <div className="text-center bg-warm-gold/5 rounded-lg py-1 -mx-1 px-1">
                  <span className="text-xs text-warm-gold block mb-1 font-medium">Prem</span>
                  {renderCell(feature.premium)}
                </div>
                <div className="text-center">
                  <span className="text-xs text-muted-foreground block mb-1 font-light">Ultm</span>
                  {renderCell(feature.ultimate)}
                </div>
              </div>
              
              {/* Subtle accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
            </div>
          ))}

          {/* Access Duration */}
          <div className="bg-white p-4 sm:p-5 group hover:bg-gray-50/50 transition-colors duration-300 relative">
            <h4 className="font-medium text-sm mb-3 text-dark-base">Access Duration</h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <span className="text-xs text-muted-foreground block mb-1 font-light">Basic</span>
                <span className="text-xs text-dark-base">1 Year</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-muted-foreground block mb-1 font-light">Std</span>
                <span className="text-xs text-dark-base">1 Year</span>
              </div>
              <div className="text-center bg-warm-gold/5 rounded-lg py-1 -mx-1 px-1">
                <span className="text-xs text-warm-gold block mb-1 font-medium">Prem</span>
                <span className="text-xs text-warm-gold font-medium">Lifetime</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-muted-foreground block mb-1 font-light">Ultm</span>
                <span className="text-xs text-dark-base font-medium">Lifetime</span>
              </div>
            </div>
            
            {/* Subtle accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
          </div>
        </div>
      </div>
    );
  }

  // Desktop table layout - Minimalist
  return (
    <div className="overflow-hidden rounded-2xl bg-gray-200">
      <Table className="bg-white">
        <TableHeader>
          <TableRow className="border-b border-gray-100 hover:bg-transparent">
            <TableHead className="w-[250px] font-medium text-dark-base bg-gray-50/50 text-sm">Feature</TableHead>
            <TableHead className="text-center font-medium text-muted-foreground bg-gray-50/50 text-sm">Basic ($55)</TableHead>
            <TableHead className="text-center font-medium text-muted-foreground bg-gray-50/50 text-sm">Standard ($65)</TableHead>
            <TableHead className="text-center font-medium text-warm-gold bg-warm-gold/5 text-sm">Premium ($80)</TableHead>
            <TableHead className="text-center font-medium text-muted-foreground bg-gray-50/50 text-sm">Ultimate ($100)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature, idx) => (
            <TableRow 
              key={idx} 
              className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors duration-300"
            >
              <TableCell className="font-medium text-dark-base text-sm">{feature.name}</TableCell>
              <TableCell className="text-center">{renderCell(feature.basic)}</TableCell>
              <TableCell className="text-center">{renderCell(feature.standard)}</TableCell>
              <TableCell className="text-center bg-warm-gold/5">{renderCell(feature.premium)}</TableCell>
              <TableCell className="text-center">{renderCell(feature.ultimate)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="hover:bg-gray-50/50 transition-colors duration-300">
            <TableCell className="font-medium text-dark-base text-sm">Access Duration</TableCell>
            <TableCell className="text-center text-sm text-muted-foreground">1 Year</TableCell>
            <TableCell className="text-center text-sm text-muted-foreground">1 Year</TableCell>
            <TableCell className="text-center text-sm font-medium text-warm-gold bg-warm-gold/5">Lifetime</TableCell>
            <TableCell className="text-center text-sm font-medium text-dark-base">Lifetime</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
