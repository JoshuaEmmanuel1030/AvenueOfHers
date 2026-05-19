import React, { useState } from 'react';
import { CheckCircle2, Clock, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TaskWithMember, Task } from '@/types';
import { cn } from '@/lib/utils';
import { format, isPast, parseISO } from 'date-fns';

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const STATUS_CONFIG: Record<Task['status'], { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  review: { label: 'Review', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  done: { label: 'Done', className: 'bg-slate-900 text-white border-slate-900' },
};

interface Props {
  tasks: TaskWithMember[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onRefresh: () => void;
}

export function TasksSection({ tasks, onAddTask, onEditTask, onRefresh }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleStatusChange = async (task: Task, newStatus: Task['status']) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    if (error) toast.error(error.message);
    else onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Task deleted.'); onRefresh(); }
    setDeletingId(null);
  };

  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'review');
  const done = tasks.filter(t => t.status === 'approved' || t.status === 'done');

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Tasks</span>
          {pending.length > 0 && (
            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        <Button size="sm" onClick={onAddTask} className="h-7 text-[11px] bg-primary text-white hover:bg-primary/90 gap-1">
          <Plus size={12} /> Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
          <CheckCircle2 size={32} className="opacity-20" />
          <p className="text-sm">No tasks yet — add one above</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.map(task => {
            const cfg = STATUS_CONFIG[task.status];
            return (
              <div key={task.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-medium', (task.status === 'done' || task.status === 'approved') && 'line-through text-slate-400')}>
                      {task.title}
                    </p>
                    {task.team_members && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: task.team_members.avatar_color }}
                      >
                        {task.team_members.name}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{task.description}</p>
                  )}
                  {task.due_date && (() => {
                    const overdue = task.status !== 'done' && task.status !== 'approved' && isPast(parseISO(task.due_date));
                    return (
                      <p className={cn('text-[10px] mt-0.5', overdue ? 'text-rose-500 font-semibold' : 'text-slate-400')}>
                        {overdue ? 'Overdue · ' : 'Due '}
                        {format(parseISO(task.due_date), 'MMM d, yyyy')}
                      </p>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.amount != null && (
                    <span className="text-sm font-semibold text-slate-700">{idr(task.amount)}</span>
                  )}

                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(task, 'review')}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      Review
                    </button>
                  )}
                  {task.status === 'review' && (
                    <button
                      onClick={() => handleStatusChange(task, 'approved')}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-border text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Approve
                    </button>
                  )}

                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.className)}>
                    {cfg.label}
                  </span>

                  {deletingId === task.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Delete?</span>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded border border-border text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEditTask(task)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDeletingId(task.id)} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="bg-slate-50 px-5 py-2 border-t border-border text-[11px] text-slate-400">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {done.length} completed
        </div>
      )}
    </div>
  );
}
