import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { cleanupOrphanedUsers } from "@/utils/admin/cleanupOrphanedUsers";

export function OrphanedUserCleanup() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleCleanup = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      const cleanupResults = await cleanupOrphanedUsers();
      setResults(cleanupResults);
      
      const successCount = cleanupResults.filter(r => r.status === 'success').length;
      const errorCount = cleanupResults.length - successCount;
      
      if (errorCount === 0) {
        toast({
          title: "Cleanup Complete",
          description: `Successfully cleaned up ${successCount} orphaned users.`
        });
      } else {
        toast({
          title: "Cleanup Partial",
          description: `${successCount} succeeded, ${errorCount} failed. Check console for details.`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Cleanup failed:", error);
      toast({
        title: "Cleanup Failed",
        description: error.message || "An error occurred during cleanup.",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Orphaned User Cleanup</CardTitle>
        <CardDescription>
          Clean up users in auth.users that don't have corresponding profiles.
          This will properly handle all foreign key constraints including discount code usage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleCleanup}
          disabled={isRunning}
          variant="destructive"
          className="w-full"
        >
          {isRunning ? "Running Cleanup..." : "Run Orphaned User Cleanup"}
        </Button>
        
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Cleanup Results:</h4>
            {results.map((result, index) => (
              <div 
                key={index} 
                className={`p-2 rounded text-sm ${
                  result.status === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <strong>{result.user}</strong>: {result.status}
                {result.error && ` - ${result.error}`}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}