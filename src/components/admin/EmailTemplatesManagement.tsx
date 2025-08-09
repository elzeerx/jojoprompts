import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MailCheck, Plus, Send } from "lucide-react";

interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  type: string;
  subject: string;
  html: string;
  text?: string | null;
  variables: any;
  locale: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function EmailTemplatesManagement() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [sendingOpen, setSendingOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<EmailTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [varsJson, setVarsJson] = useState("{}");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.slug.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q)
    );
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ variant: "destructive", title: "Load failed", description: error.message });
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const openCreate = () => {
    setCurrent({ slug: "", name: "", type: "general", subject: "", html: "", text: "", locale: "en", is_active: true, variables: {} });
    setVarsJson("{}");
    setEditorOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setCurrent({ ...t });
    setVarsJson(JSON.stringify(t.variables || {}, null, 2));
    setEditorOpen(true);
  };

  const remove = async (t: EmailTemplate) => {
    if (!confirm(`Delete template ${t.slug}?`)) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", t.id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
    } else {
      toast({ title: "Deleted" });
      setItems((prev) => prev.filter((i) => i.id !== t.id));
    }
  };

  const save = async () => {
    if (!current) return;
    setSaving(true);
    let parsedVars: any = {};
    try {
      parsedVars = varsJson ? JSON.parse(varsJson) : {};
    } catch (e: any) {
      toast({ variant: "destructive", title: "Invalid variables JSON", description: e.message });
      setSaving(false);
      return;
    }

    const payload = { ...current, variables: parsedVars } as any;
    let error;
    let saved: any;
    if (current.id) {
      const res = await supabase.from("email_templates").update(payload).eq("id", current.id).select("*").maybeSingle();
      error = res.error;
      saved = res.data;
    } else {
      const res = await supabase.from("email_templates").insert(payload).select("*").maybeSingle();
      error = res.error;
      saved = res.data;
    }

    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: current.id ? "Updated" : "Created" });
      setEditorOpen(false);
      setCurrent(null);
      await load();
    }
    setSaving(false);
  };

  const openSendTest = (t: EmailTemplate) => {
    setCurrent({ ...t });
    setVarsJson(JSON.stringify(t.variables || {}, null, 2));
    setTestEmail("");
    setSendingOpen(true);
  };

  const sendTest = async () => {
    if (!current || !testEmail) {
      toast({ variant: "destructive", title: "Provide a recipient" });
      return;
    }
    let parsedVars: any = {};
    try {
      parsedVars = varsJson ? JSON.parse(varsJson) : {};
    } catch (e: any) {
      toast({ variant: "destructive", title: "Invalid variables JSON", description: e.message });
      return;
    }

    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to: testEmail,
        template_slug: current.slug,
        email_type: current.type,
        variables: parsedVars,
      },
    });
    setSending(false);

    if (error || (data && data.success === false)) {
      toast({ variant: "destructive", title: "Test failed", description: error?.message || data?.error || "Unknown error" });
    } else {
      toast({ title: "Test sent" });
      setSendingOpen(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div>
          <h2 className="section-title text-lg sm:text-xl">Email Templates</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Create, edit, and send test emails with variables.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search by slug, name, subject" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full sm:w-64" />
          <Button onClick={openCreate} className="mobile-button-primary" size="sm">
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-soft-bg/60">
            <tr>
              <th className="text-left p-3">Slug</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Subject</th>
              <th className="text-left p-3">Locale</th>
              <th className="text-left p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 inline animate-spin" /> Loading templates...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">No templates</td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-mono text-xs sm:text-sm">{t.slug}</td>
                  <td className="p-3">{t.name}</td>
                  <td className="p-3">{t.type}</td>
                  <td className="p-3">{t.subject}</td>
                  <td className="p-3">{t.locale}</td>
                  <td className="p-3">{t.is_active ? "Yes" : "No"}</td>
                  <td className="p-3 text-right space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => openSendTest(t)}>
                      <Send className="h-4 w-4 mr-1" /> Test
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(t)}>Delete</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <DialogTitle className="section-title text-lg sm:text-xl">
              {current?.id ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Slug</Label>
                <Input value={current?.slug || ""} onChange={(e) => setCurrent((c) => ({ ...(c as any), slug: e.target.value }))} />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={current?.name || ""} onChange={(e) => setCurrent((c) => ({ ...(c as any), name: e.target.value }))} />
              </div>
              <div>
                <Label>Type</Label>
                <Input value={current?.type || ""} onChange={(e) => setCurrent((c) => ({ ...(c as any), type: e.target.value }))} />
              </div>
              <div>
                <Label>Locale</Label>
                <Input value={current?.locale || "en"} onChange={(e) => setCurrent((c) => ({ ...(c as any), locale: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label>Active</Label>
                <Switch checked={!!current?.is_active} onCheckedChange={(v) => setCurrent((c) => ({ ...(c as any), is_active: v }))} />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input value={current?.subject || ""} onChange={(e) => setCurrent((c) => ({ ...(c as any), subject: e.target.value }))} />
              </div>
              <div>
                <Label>Variables (JSON)</Label>
                <Textarea rows={6} value={varsJson} onChange={(e) => setVarsJson(e.target.value)} />
              </div>
            </div>
            <div className="md:col-span-2 space-y-3">
              <div>
                <Label>HTML</Label>
                <Textarea rows={10} value={current?.html || ""} onChange={(e) => setCurrent((c) => ({ ...(c as any), html: e.target.value }))} />
              </div>
              <div>
                <Label>Plain Text (optional)</Label>
                <Textarea rows={5} value={current?.text || ""} onChange={(e) => setCurrent((c) => ({ ...(c as any), text: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving} className="mobile-button-primary">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* Send Test Dialog */}
      <Dialog open={sendingOpen} onOpenChange={setSendingOpen}>
        <DialogContent className="max-w-xl w-[95vw] p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <DialogTitle className="section-title text-lg sm:text-xl">Send Test Email</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-3">
            <div>
              <Label>Recipient email</Label>
              <Input placeholder="name@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            </div>
            <div>
              <Label>Variables (JSON)</Label>
              <Textarea rows={6} value={varsJson} onChange={(e) => setVarsJson(e.target.value)} />
            </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendingOpen(false)}>Cancel</Button>
                <Button onClick={sendTest} disabled={sending} className="mobile-button-secondary">
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MailCheck className="h-4 w-4 mr-2" />} Send Test
                </Button>
              </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}

export default EmailTemplatesManagement;
