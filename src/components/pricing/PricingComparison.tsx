
import React from 'react';
import { Check, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';

export function PricingComparison() {
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
        <Check className="h-5 w-5 text-warm-gold mx-auto" />
      ) : (
        <X className="h-5 w-5 text-gray-300 mx-auto" />
      );
    }
    return <span className="text-center block">{value}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <Table className="border rounded-lg">
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[250px]">Feature</TableHead>
            <TableHead className="text-center">Basic ($55)</TableHead>
            <TableHead className="text-center">Standard ($65)</TableHead>
            <TableHead className="text-center bg-warm-gold/10">Premium ($80)</TableHead>
            <TableHead className="text-center">Ultimate ($100)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{feature.name}</TableCell>
              <TableCell className="text-center">{renderCell(feature.basic)}</TableCell>
              <TableCell className="text-center">{renderCell(feature.standard)}</TableCell>
              <TableCell className={cn("text-center", "bg-warm-gold/5")}>{renderCell(feature.premium)}</TableCell>
              <TableCell className="text-center">{renderCell(feature.ultimate)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-gray-50">
            <TableCell className="font-medium">Access Duration</TableCell>
            <TableCell className="text-center">1 Year</TableCell>
            <TableCell className="text-center">1 Year</TableCell>
            <TableCell className={cn("text-center font-medium text-warm-gold", "bg-warm-gold/5")}>Lifetime</TableCell>
            <TableCell className="text-center font-medium">Lifetime</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
