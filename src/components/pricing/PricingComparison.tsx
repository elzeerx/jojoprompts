
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
        <Check className="mobile-icon text-warm-gold mx-auto" />
      ) : (
        <X className="mobile-icon text-gray-300 mx-auto" />
      );
    }
    return <span className="text-center block text-xs sm:text-sm font-medium">{value}</span>;
  };

  if (isMobile) {
    // Mobile-first comparison cards layout
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Mobile Plan Headers */}
        <div className="mobile-grid-2 gap-3 mb-6">
          <div className="mobile-card bg-gray-50 text-center">
            <h3 className="font-bold text-sm text-dark-base">Basic</h3>
            <p className="text-xs text-muted-foreground">$55</p>
          </div>
          <div className="mobile-card bg-gray-50 text-center">
            <h3 className="font-bold text-sm text-dark-base">Standard</h3>
            <p className="text-xs text-muted-foreground">$65</p>
          </div>
          <div className="mobile-card bg-warm-gold/10 border-warm-gold/30 text-center">
            <h3 className="font-bold text-sm text-warm-gold">Premium</h3>
            <p className="text-xs text-muted-foreground">$80</p>
          </div>
          <div className="mobile-card bg-gray-50 text-center">
            <h3 className="font-bold text-sm text-dark-base">Ultimate</h3>
            <p className="text-xs text-muted-foreground">$100</p>
          </div>
        </div>

        {/* Mobile Feature Comparison */}
        {features.map((feature, idx) => (
          <div key={idx} className="mobile-card">
            <h4 className="font-medium text-sm sm:text-base mb-3 text-dark-base">{feature.name}</h4>
            <div className="mobile-grid-2 gap-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-xs font-medium">Basic</span>
                {renderCell(feature.basic)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-xs font-medium">Standard</span>
                {renderCell(feature.standard)}
              </div>
              <div className="flex items-center justify-between p-2 bg-warm-gold/10 rounded border border-warm-gold/20">
                <span className="text-xs font-medium text-warm-gold">Premium</span>
                {renderCell(feature.premium)}
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-xs font-medium">Ultimate</span>
                {renderCell(feature.ultimate)}
              </div>
            </div>
          </div>
        ))}

        {/* Access Duration for Mobile */}
        <div className="mobile-card bg-gray-50">
          <h4 className="font-medium text-sm sm:text-base mb-3 text-dark-base">Access Duration</h4>
          <div className="mobile-grid-2 gap-2">
            <div className="flex items-center justify-between p-2 bg-white rounded">
              <span className="text-xs font-medium">Basic</span>
              <span className="text-xs">1 Year</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white rounded">
              <span className="text-xs font-medium">Standard</span>
              <span className="text-xs">1 Year</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-warm-gold/10 rounded border border-warm-gold/20">
              <span className="text-xs font-medium text-warm-gold">Premium</span>
              <span className="text-xs font-medium text-warm-gold">Lifetime</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white rounded">
              <span className="text-xs font-medium">Ultimate</span>
              <span className="text-xs font-medium">Lifetime</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className="overflow-x-auto mobile-smooth-scroll">
      <Table className="border rounded-lg bg-white shadow-sm">
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[250px] font-semibold text-dark-base">Feature</TableHead>
            <TableHead className="text-center font-semibold">Basic ($55)</TableHead>
            <TableHead className="text-center font-semibold">Standard ($65)</TableHead>
            <TableHead className="text-center bg-warm-gold/10 font-semibold text-warm-gold">Premium ($80)</TableHead>
            <TableHead className="text-center font-semibold">Ultimate ($100)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature, idx) => (
            <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
              <TableCell className="font-medium text-dark-base">{feature.name}</TableCell>
              <TableCell className="text-center">{renderCell(feature.basic)}</TableCell>
              <TableCell className="text-center">{renderCell(feature.standard)}</TableCell>
              <TableCell className={cn("text-center", "bg-warm-gold/5")}>{renderCell(feature.premium)}</TableCell>
              <TableCell className="text-center">{renderCell(feature.ultimate)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-gray-50 font-medium">
            <TableCell className="font-semibold text-dark-base">Access Duration</TableCell>
            <TableCell className="text-center">1 Year</TableCell>
            <TableCell className="text-center">1 Year</TableCell>
            <TableCell className={cn("text-center font-semibold text-warm-gold", "bg-warm-gold/5")}>Lifetime</TableCell>
            <TableCell className="text-center font-semibold">Lifetime</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
