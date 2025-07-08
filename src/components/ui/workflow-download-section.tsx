
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileArchive } from "lucide-react";
import { downloadWorkflowFile } from "@/utils/download";

interface WorkflowFile {
  type: 'json' | 'zip';
  path: string;
  name: string;
}

interface WorkflowDownloadSectionProps {
  workflowFiles: WorkflowFile[];
  className?: string;
}

export function WorkflowDownloadSection({ workflowFiles, className = "" }: WorkflowDownloadSectionProps) {
  if (!workflowFiles || workflowFiles.length === 0) {
    return null;
  }

  const handleDownload = async (file: WorkflowFile) => {
    await downloadWorkflowFile(file.path, file.name);
  };

  const getFileIcon = (type: 'json' | 'zip') => {
    return type === 'json' ? <FileJson className="h-4 w-4" /> : <FileArchive className="h-4 w-4" />;
  };

  const getFileColor = (type: 'json' | 'zip') => {
    return type === 'json' ? 'text-blue-600' : 'text-purple-600';
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <Download className="h-4 w-4 text-blue-600" />
        Workflow Files ({workflowFiles.length})
      </h4>
      <div className="space-y-2">
        {workflowFiles.map((file, index) => (
          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={getFileColor(file.type)}>
                {getFileIcon(file.type)}
              </div>
              <span className="text-sm text-gray-700 truncate">{file.name}</span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                {file.type.toUpperCase()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(file)}
              className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
