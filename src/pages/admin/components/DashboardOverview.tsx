
import { useEffect, useState } from "react";
import { FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Stats {
  prompts: number;
  users: number;
  signups: number;
  aiRuns: number;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    prompts: 0,
    users: 0,
    signups: 0,
    aiRuns: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: prompts } = await supabase.from("prompts").select("id");
      const { data: users } = await supabase.from("profiles").select("id");
      setStats({
        prompts: prompts?.length ?? 0,
        users: users?.length ?? 0,
        signups: users?.length ?? 0, // update if you track sign-up date
        aiRuns: 0
      });
    })();
  }, []);

  // Only show cards with real data
  const cards = [
    {
      title: "Total Prompts",
      value: stats.prompts,
      icon: FileText,
    },
    {
      title: "Total Users",
      value: stats.users,
      icon: Users,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {card.value === 0 ? "No data yet" : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest user actions and system events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No activity yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
