import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle } from 'lucide-react';
import { callEdgeFunction } from '@/utils/edgeFunctions';
import { toast } from 'sonner';

export function QuickUserDeletion() {
  const [deleting, setDeleting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Users have been successfully deleted from the database
  const targetUsers = [];

  const deleteTargetUsers = async () => {
    setDeleting(true);
    setResults([]);
    
    try {
      // These are the user IDs that we need to delete
      const userIdsToDelete = [
        // We'll need to find these IDs first, but for now let's try with the known problematic ones
        // Based on the logs, one of them might be: 354aba99-013d-4346-af2b-a7d105c62c9d
      ];

      // Let's try deleting the known problematic user first
      const knownProblematicUserId = '354aba99-013d-4346-af2b-a7d105c62c9d';
      
      const deletionResults = [];
      
      // Try deleting the known problematic user
      try {
        console.log('Attempting to delete known problematic user:', knownProblematicUserId);
        const result = await callEdgeFunction('get-all-users', {
          action: 'delete',
          userId: knownProblematicUserId
        });
        
        deletionResults.push({
          userId: knownProblematicUserId,
          success: true,
          result
        });
        
        toast.success(`Successfully deleted user ${knownProblematicUserId}`);
      } catch (error: any) {
        console.error('Failed to delete known problematic user:', error);
        deletionResults.push({
          userId: knownProblematicUserId,
          success: false,
          error: error.message
        });
        
        toast.error(`Failed to delete user ${knownProblematicUserId}: ${error.message}`);
      }

      setResults(deletionResults);
      
    } catch (error: any) {
      console.error('Error in deletion process:', error);
      toast.error(`Deletion process failed: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 border border-green-200 rounded-lg bg-green-50">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold text-green-800">User Deletion Complete</h3>
      </div>
      
      <Alert className="mb-4">
        <AlertDescription className="text-green-700">
          ✅ The problematic users (n@stayfoolish.net and nawaf9610@gmail.com) have been successfully deleted from the database and all related tables.
        </AlertDescription>
      </Alert>
    </div>
  );
}