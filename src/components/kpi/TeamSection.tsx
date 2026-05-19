import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TeamMember, TaskWithMember } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  members: TeamMember[];
  tasks: TaskWithMember[];
  onAddMember: () => void;
  onEditMember: (member: TeamMember) => void;
  onRefresh: () => void;
}

export function TeamSection({ members, tasks, onAddMember, onEditMember, onRefresh }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Member removed.'); onRefresh(); }
    setDeletingId(null);
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-50">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Team</span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" onClick={onAddMember} className="h-7 text-[11px] bg-primary text-white hover:bg-primary/90 gap-1">
          <Plus size={12} /> Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
          <Users size={32} className="opacity-20" />
          <p className="text-sm">No team members yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {members.map(member => {
            const memberTasks = tasks.filter(t => t.assigned_to === member.id);
            const done = memberTasks.filter(t => t.status === 'done' || t.status === 'approved').length;
            const total = memberTasks.length;

            return (
              <div key={member.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: member.avatar_color }}
                >
                  {member.name[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                  {member.role && <p className="text-[11px] text-slate-400">{member.role}</p>}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {total > 0 ? (
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">{done}/{total}</p>
                      <p className="text-[10px] text-slate-400">tasks done</p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300">No tasks</span>
                  )}

                  {total > 0 && (
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      done === total && total > 0
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    )}>
                      {done === total && total > 0 ? 'done' : 'in progress'}
                    </span>
                  )}

                  {deletingId === member.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Remove?</span>
                      <button
                        onClick={() => handleDelete(member.id)}
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
                      <button onClick={() => onEditMember(member)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDeletingId(member.id)} className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500">
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

      {members.length > 0 && (
        <div className="bg-slate-50 px-5 py-2 border-t border-border text-[11px] text-slate-400">
          {members.length} member{members.length !== 1 ? 's' : ''} · {tasks.filter(t => t.assigned_to !== null).length} assigned tasks
        </div>
      )}
    </div>
  );
}
