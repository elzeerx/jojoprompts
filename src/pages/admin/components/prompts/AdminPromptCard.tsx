
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash } from "lucide-react";
import { type PromptRow } from "@/types";

interface AdminPromptCardProps {
  prompt: PromptRow;
  onEdit: (promptId: string) => void;
  onDelete: (promptId: string) => void;
}

export function AdminPromptCard({ prompt, onEdit, onDelete }: AdminPromptCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{prompt.title}</CardTitle>
        <CardDescription>
          Category: {prompt.metadata.category || "N/A"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {prompt.prompt_text.substring(0, 100)}...
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onEdit(prompt.id)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                prompt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(prompt.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
