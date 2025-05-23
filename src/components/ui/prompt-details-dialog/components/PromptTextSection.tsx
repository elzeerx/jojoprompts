
interface PromptTextSectionProps {
  promptText: string;
}

export function PromptTextSection({ promptText }: PromptTextSectionProps) {
  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-4">Prompt Text</h3>
      <div className="bg-gray-50 p-4 rounded-lg border max-h-60 overflow-y-auto">
        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
          {promptText}
        </p>
      </div>
    </div>
  );
}
