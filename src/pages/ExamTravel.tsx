import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Bus, ChevronDown, ChevronUp } from 'lucide-react';
import { useTitle } from '@/lib/hooks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ExamCard } from '@/components/features/scaler/ExamCard';
import { CentreStudentList } from '@/components/features/scaler/CentreStudentList';
import { BusRegistrationForm } from '@/components/features/bus/BusRegistrationForm';
import { useMyHallTickets, useExamSchedule } from '@/hooks/useHallTicket';
import type { ExamType, HallTicket } from '@/lib/database.types';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

const EXAM_TYPES: ExamType[]             = ['quiz1', 'quiz2', 'endterm'];
const EXAM_LABELS: Record<ExamType, string> = {
  quiz1:   'Quiz 1',
  quiz2:   'Quiz 2',
  endterm: 'End Term',
};

function ExamSection({
  examType,
  examDate,
  centreRegOpen,
  hallTicket,
  isLoading,
}: {
  examType:      ExamType;
  examDate:      string | null;
  centreRegOpen: boolean | null;
  hallTicket:    HallTicket | null | undefined;
  isLoading:     boolean;
}) {
  const [showClassmates, setShowClassmates] = useState(false);
  const centreName = hallTicket?.centre_name ?? null;

  return (
    <div className="space-y-2">
      <ExamCard
        examType={examType}
        examDate={examDate}
        centreRegOpen={centreRegOpen}
        hallTicket={hallTicket}
        isLoading={isLoading}
      />

      {/* Live classmate list — only shown when the student has registered */}
      {hallTicket && !isLoading && (
        <div>
          <button
            type="button"
            onClick={() => setShowClassmates((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-[12px] text-fgmuted hover:bg-surface2 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              See classmates at {hallTicket.centre_name}
            </span>
            {showClassmates ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showClassmates && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-1"
            >
              <CentreStudentList centreName={centreName} examType={examType} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExamTravel() {
  useTitle('Exam Travel');
  const { data: hallTickets = [], isLoading: ticketsLoading } = useMyHallTickets();
  const { data: schedule = [],    isLoading: scheduleLoading } = useExamSchedule();
  const [activeTab,        setActiveTab]        = useState<'halls' | 'bus'>('halls');
  const [selectedBusExam,  setSelectedBusExam]  = useState<ExamType>('quiz1');

  type ScheduleEntry = { exam_date: string; centre_reg_open: boolean | null };
  const scheduleMap = Object.fromEntries(
    schedule.map((s: { exam_type: string; exam_date: string; centre_reg_open: boolean | null }) => [
      s.exam_type,
      { exam_date: s.exam_date, centre_reg_open: s.centre_reg_open },
    ]),
  ) as Record<ExamType, ScheduleEntry | undefined>;

  const ticketMap = Object.fromEntries(
    hallTickets.map((t) => [t.exam_type, t]),
  ) as Record<ExamType, HallTicket | undefined>;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="p-4 md:p-6 max-w-2xl mx-auto space-y-5"
    >
      <motion.div variants={fadeUp}>
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-tightest whitespace-nowrap">Exam Travel</h1>
          <span className="text-[13px] text-fgmuted hidden sm:inline">Register centre &amp; book bus</span>
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'halls' | 'bus')}>
          <TabsList className="w-full">
            <TabsTrigger value="halls" className="flex-1 gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Exam Centres
            </TabsTrigger>
            <TabsTrigger value="bus" className="flex-1 gap-1.5">
              <Bus className="h-3.5 w-3.5" /> Bus Registration
            </TabsTrigger>
          </TabsList>

          {/* ── Exam Centres tab ─────────────────────────────────────── */}
          <TabsContent value="halls" className="mt-4 space-y-4">
            {EXAM_TYPES.map((et) => (
              <ExamSection
                key={et}
                examType={et}
                examDate={scheduleMap[et]?.exam_date ?? null}
                centreRegOpen={scheduleMap[et]?.centre_reg_open ?? null}
                hallTicket={ticketMap[et]}
                isLoading={ticketsLoading || scheduleLoading}
              />
            ))}
          </TabsContent>

          {/* ── Bus Registration tab ─────────────────────────────────── */}
          <TabsContent value="bus" className="mt-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {EXAM_TYPES.map((et) => (
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
