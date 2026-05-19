import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { Sale, TeamMember, TaskWithMember, MonthlyTarget, Task } from '@/types';
import { MonthlyTargetCard } from '@/components/kpi/MonthlyTargetCard';
import { StatsRow } from '@/components/kpi/StatsRow';
import { TasksSection } from '@/components/kpi/TasksSection';
import { TeamSection } from '@/components/kpi/TeamSection';
import { AddTaskModal } from '@/components/kpi/AddTaskModal';
import { AddMemberModal } from '@/components/kpi/AddMemberModal';
import { SetTargetModal } from '@/components/kpi/SetTargetModal';

export function KPIPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [tasks, setTasks] = useState<TaskWithMember[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [target, setTarget] = useState<MonthlyTarget | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [showSetTarget, setShowSetTarget] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const year = getYear(now);
      const month = getMonth(now) + 1;
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      const [salesRes, tasksRes, membersRes, targetRes] = await Promise.all([
        supabase.from('sales').select('*').gte('sale_date', monthStart).lte('sale_date', monthEnd),
        supabase.from('tasks').select('*, team_members(*)').order('created_at', { ascending: false }),
        supabase.from('team_members').select('*').order('created_at', { ascending: true }),
        supabase.from('monthly_targets').select('*').eq('year', year).eq('month', month).maybeSingle(),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (membersRes.error) throw membersRes.error;
      if (targetRes.error) throw targetRes.error;

      setSales((salesRes.data as Sale[]) || []);
      setTasks((tasksRes.data as any) || []);
      setMembers((membersRes.data as TeamMember[]) || []);
      setTarget(targetRes.data as MonthlyTarget | null);
    } catch (err: any) {
      toast.error('Failed to load KPI data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const now = new Date();
  const monthRevenue = sales.reduce((s, sale) => s + sale.revenue, 0);
  const orderCount = sales.length;
  const totalUnits = sales.reduce((s, sale) => s + sale.qty, 0);
  const aov = orderCount > 0 ? monthRevenue / orderCount : 0;
  const revenueTarget = target?.revenue_target ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white h-20">
        <div>
          <h2 className="text-xl font-semibold text-slate-700">Daily KPI</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{format(now, "EEEE · MMM d")} · auto-synced</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="border-border">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-5 animate-pulse">
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 h-36" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-border shadow-sm p-4 h-20" />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 h-52" />
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 h-40" />
        </div>
      ) : (
        <div className="space-y-5">
          <MonthlyTargetCard
            revenue={monthRevenue}
            target={revenueTarget}
            onSetTarget={() => setShowSetTarget(true)}
          />

          <StatsRow orderCount={orderCount} aov={aov} totalUnits={totalUnits} />

          <TasksSection
            tasks={tasks}
            onAddTask={() => { setEditTask(null); setShowAddTask(true); }}
            onEditTask={task => { setEditTask(task); setShowAddTask(true); }}
            onRefresh={fetchAll}
          />

          <TeamSection
            members={members}
            tasks={tasks}
            onAddMember={() => { setEditMember(null); setShowAddMember(true); }}
            onEditMember={m => { setEditMember(m); setShowAddMember(true); }}
            onRefresh={fetchAll}
          />
        </div>
      )}

      <AddTaskModal
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSuccess={fetchAll}
        members={members}
        editTask={editTask}
      />
      <AddMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSuccess={fetchAll}
        editMember={editMember}
      />
      <SetTargetModal
        open={showSetTarget}
        onClose={() => setShowSetTarget(false)}
        onSuccess={fetchAll}
        currentTarget={revenueTarget}
      />
    </div>
  );
}
