import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Bus } from 'lucide-react';
import { useTitle } from '@/lib/hooks';
import { useAuth } from '@/stores/auth';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ExamCard } from '@/components/features/scaler/ExamCard';
import { CentreStudentList } from '@/components/features/scaler/CentreStudentList';
import { BusRegistrationForm } from '@/components/features/bus/BusRegistrationForm';
import { useMyHallTickets, useExamSchedule } from '@/hooks/useHallTicket';
import type { ExamType } from '@/lib/database.types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

const EXAM_TYPES: ExamType[] = ['quiz1', 'quiz2', 'endterm'];
const EXAM_LABELS: Record<ExamType, string> = {
  quiz1: 'Quiz 1',
  quiz2: 'Quiz 2',
  endterm: 'End Term',
};

function getUpcomingExam(scheduleData: Array<{ exam_type: string; exam_date: string }>): {
  examType: ExamType | null;
  centreName: string | null;
} {
  return { examType: null, centreName: null };
}

export default function ExamTravel() {
  useTitle('Exam Travel');
  const { profile } = useAuth();
  const { data: hallTickets = [], isLoading: ticketsLoading } = useMyHallTickets();
  const { data: schedule = [], isLoading: scheduleLoading } = useExamSchedule();
  const [activeTab, setActiveTab] = useState<'halls' | 'bus'>('halls');
  const [selectedBusExam, setSelectedBusExam] = useState<ExamType>('quiz1');

  const scheduleMap = Object.fromEntries(
    schedule.map((s: { exam_type: string; exam_date: string }) => [s.exam_type, s.exam_date])
  ) as Record<ExamType, string | undefined>;

  const ticketMap = Object.fromEntries(
    hallTickets.map(t => [t.exam_type, t])
  ) as Record<ExamType, typeof hallTickets[0] | undefined>;

  // Determine upcoming exam for centre list (nearest future exam with a hall ticket)
  const now = new Date();
  const upcomingTicket = EXAM_TYPES
    .filter(et => {
      const t = ticketMap[et];
      const d = scheduleMap[et];
      return t && d && new Date(d) >= now;
    })
    .sort((a, b) => {
      const da = scheduleMap[a] ? new Date(scheduleMap[a]!).getTime() : Infinity;
      const db = scheduleMap[b] ? new Date(scheduleMap[b]!).getTime() : Infinity;
      return da - db;
    })[0];

  const centreForList = upcomingTicket ? (ticketMap[upcomingTicket]?.centre_name ?? null) : null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="p-4 md:p-6 max-w-2xl mx-auto space-y-5"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-lg font-bold tracking-tightest">Exam Travel</h1>
        <p className="text-[13px] text-fgmuted mt-0.5">
          Upload your hall ticket, find classmates at your centre, and register for the hostel bus.
        </p>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'halls' | 'bus')}>
          <TabsList className="w-full">
            <TabsTrigger value="halls" className="flex-1 gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Hall Tickets & Centre
            </TabsTrigger>
            <TabsTrigger value="bus" className="flex-1 gap-1.5">
              <Bus className="h-3.5 w-3.5" /> Bus Registration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="halls" className="mt-4 space-y-4">
            {/* Exam cards */}
            <div className="grid gap-3">
              {EXAM_TYPES.map(et => (
                <ExamCard
                  key={et}
                  examType={et}
                  examDate={scheduleMap[et] ?? null}
                  hallTicket={ticketMap[et] ?? null}
                  isLoading={ticketsLoading || scheduleLoading}
                />
              ))}
            </div>

            {/* Centre student list */}
            <CentreStudentList
              centreName={centreForList}
              examType={upcomingTicket ?? null}
            />
          </TabsContent>

          <TabsContent value="bus" className="mt-4 space-y-4">
            {/* Exam selector for bus */}
            <div className="flex gap-2 flex-wrap">
              {EXAM_TYPES.map(et => (
                <button
                  key={et}
                  onClick={() => setSelectedBusExam(et)}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    selectedBusExam === et
                      ? 'bg-accent text-accentfg'
                      : 'bg-surface2 text-fgmuted hover:text-fg'
                  }`}
                >
                  {EXAM_LABELS[et]}
                </button>
              ))}
            </div>

            <BusRegistrationForm
              examType={selectedBusExam}
              hallTicket={ticketMap[selectedBusExam] ?? null}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
