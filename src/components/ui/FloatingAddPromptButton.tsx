
import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PromptDialog } from "@/pages/admin/components/prompts/PromptDialog";
import { PromptTypeMenu } from "./prompt-type-menu";

export function FloatingAddPromptButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [promptType, setPromptType] = useState<"text" | "image">("image");

  if (!user) return null;

  return (
    <>
      <PromptTypeMenu
        onSelect={(type) => {
          setPromptType(type);
          setOpen(true);
        }}
        trigger={
          <button
            type="button"
            aria-label="Add Prompt"
            title="Add Prompt"
            className="fixed z-50 bottom-8 right-8 md:bottom-10 md:right-10 transition-transform animate-fade-in hover:scale-110 peer"
            style={{
              background: "none",
              boxShadow: "0 6px 24px 0 #E5DEFF",
              border: "none",
              padding: 0,
              borderRadius: "9999px"
            }}
          >
            <span className="relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20">
              <span
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle, #E5DEFF 50%, transparent 90%)",
                  filter: "blur(3px)",
                  zIndex: 0,
                }}
              />
              <PlusCircle
                size={52}
                strokeWidth={1.9}
                className="relative z-10 text-[#7847E8] drop-shadow-lg transition-transform hover:rotate-12 hover:text-[#5022d0]"
              />
            </span>
          </button>
        }
      />

      <PromptDialog
        open={open}
        onOpenChange={setOpen}
        initial={null}
        promptType={promptType}
        onSave={async () => {
          setOpen(false);
          return Promise.resolve();
        }}
      />
    </>
  );
}
