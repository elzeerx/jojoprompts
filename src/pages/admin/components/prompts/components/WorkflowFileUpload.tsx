
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileArchive, FileJson, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WorkflowFile {
  file: File;
  name: string;
  type: 'json' | 'zip';
  preview?: string;
}

interface WorkflowFileUploadProps {
  workflowFiles: WorkflowFile[];
  onWorkflowFilesChange: (files: WorkflowFile[]) => void;
  onFilesChange?: (files: File[]) => void;
}

export function WorkflowFileUpload({ workflowFiles, onWorkflowFilesChange, onFilesChange }: WorkflowFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const validFiles: WorkflowFile[] = [];
    const fileArray: File[] = [];

    Array.from(files).forEach(file => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'json' || fileExtension === 'zip') {
        const workflowFile: WorkflowFile = {
          file,
          name: file.name,
          type: fileExtension as 'json' | 'zip'
        };
        
        validFiles.push(workflowFile);
        fileArray.push(file);
      } else {
        toast({
          title: "Invalid file type",
          description: `Only JSON and ZIP files are allowed for n8n workflows. Skipped: ${file.name}`,
          variant: "destructive"
        });
      }
    });

    if (validFiles.length > 0) {
      const updatedFiles = [...workflowFiles, ...validFiles];
      onWorkflowFilesChange(updatedFiles);
      
      if (onFilesChange) {
        onFilesChange(fileArray);
      }
      
      toast({
        title: "Files added",
        description: `Added ${validFiles.length} workflow file(s)`
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    const updatedFiles = workflowFiles.filter((_, i) => i !== index);
    onWorkflowFilesChange(updatedFiles);
    
    toast({
      title: "File removed",
      description: "Workflow file has been removed"
    });
  };

  const getFileIcon = (type: 'json' | 'zip') => {
    return type === 'json' ? <FileJson className="h-4 w-4" /> : <FileArchive className="h-4 w-4" />;
  };

  const getFileColor = (type: 'json' | 'zip') => {
    return type === 'json' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">n8n Workflow Files (JSON/ZIP)</Label>
        <p className="text-xs text-gray-500 mt-1">
          Upload JSON workflow files or ZIP packages for n8n users to download and import
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop JSON or ZIP files here, or click to browse
        </p>
        <Input
          type="file"
          accept=".json,.zip"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="workflow-file-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('workflow-file-input')?.click()}
        >
          Choose Files
        </Button>
      </div>

      {/* File List */}
      {workflowFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Uploaded Workflow Files ({workflowFiles.length})</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {workflowFiles.map((workflowFile, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  {getFileIcon(workflowFile.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {workflowFile.name}
                    </p>
                    <Badge variant="outline" className={`text-xs ${getFileColor(workflowFile.type)}`}>
                      {workflowFile.type.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
