import { ScrollText, Clock, Shield, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Audit Log — placeholder.
 *
 * Phase 4 ships the page shell and route so admins can deep-link to it
 * and we have a stable home for the feature. The data layer (DB table,
 * RLS, edge function aggregation) lands in a follow-up phase.
 */
export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-warm-gold" />
            <h1 className="text-xl sm:text-2xl font-semibold text-dark-base">
              Audit Log
            </h1>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Preview
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            A consolidated, tamper-evident timeline of admin and security
            actions across the platform. Wiring to the database is part of the
            next phase — the surface below previews what will live here.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Auth events
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Logins, password resets, role changes, suspicious sessions.
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-muted-foreground" />
              Data changes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Prompt/category edits, plan updates, discount activity, user edits.
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Filters & export
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Filter by actor, action, time range; export to CSV for compliance.
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <ScrollText className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No events to display yet.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Audit ingestion goes live in the next phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
