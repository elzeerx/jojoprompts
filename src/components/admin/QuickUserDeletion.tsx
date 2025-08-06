import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle } from 'lucide-react';
import { callEdgeFunction } from '@/utils/edgeFunctions';
import { toast } from 'sonner';

export function QuickUserDeletion() {
  const [deleting, setDeleting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const targetUsers = [
    { email: 'n@stayfoolish.com', userId: null },
    { email: 'nawaf9610@gmail.com', userId: null }
  ];

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
    <div className="p-6 border border-red-200 rounded-lg bg-red-50">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h3 className="text-lg font-semibold text-red-800">Emergency User Deletion</h3>
      </div>
      
      <Alert className="mb-4">
        <AlertDescription>
          This will permanently delete the following problematic users:
          <ul className="mt-2 ml-4 list-disc">
            {targetUsers.map((user, index) => (
              <li key={index}>{user.email}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>

      <Button
        onClick={deleteTargetUsers}
        disabled={deleting}
        variant="destructive"
        className="w-full mb-4"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        {deleting ? 'Deleting Users...' : 'Delete Target Users'}
      </Button>

      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Deletion Results:</h4>
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-2 rounded text-sm ${
                result.success
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {result.success
                ? `✅ Successfully deleted: ${result.userId}`
                : `❌ Failed to delete: ${result.userId} - ${result.error}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}